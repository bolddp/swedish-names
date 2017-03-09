var http = require('http');
var fs = require('fs');

// Get the API method description
http.get('http://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0001/BE0001TNamn10', (response) => {
  let body = '';
  response.on('data', x => {
    body += x;
  });
  response.on('end', () => {
    console.log('GET finished');
    const data = JSON.parse(body);
    processGetResponse(data.variables[0].values);
  });
});

function processGetResponse(queryValues) {
  // Construct the post data to send to the API
  const postData = JSON.stringify({   
	  query: [
      { code: "Tilltalsnamn", selection: { filter: "item", values: queryValues } },
      { code: "Tid", selection: { filter: "item", values: [ "2016" ] } }
    ],
    response: { format: "json" } 
  });

  let postRequest = http.request(
    {
      host: 'api.scb.se',
      port: 80,
      path: '/OV0104/v1/doris/sv/ssd/BE/BE0001/BE0001TNamn10',
      method: 'POST',
      headers: {
          'User-Agent': 'NameProcessor/0.0.1',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
      }      
    },
    (response) => {
      let body = '';
      response.setEncoding('utf8');

      response.on('data', x => {
        body += x;
      });
      response.on('end', () => {
        console.log('POST finished');
        const data = JSON.parse(body.substring(1));
        processPostResponse(data);
      });
    }
  );

  postRequest.on('socket', function (socket) {
    socket.setTimeout(60000);  
    socket.on('timeout', function() {
        req.abort();
    });
  });

  postRequest.write(postData);
  postRequest.end();
}

function processPostResponse(data) {
  console.log('Processing POST data');
  const nameRegex = /(.*)([K|M])/
  const allNames = [];
  const nameStats = {};
  data.data.forEach(x => {
    const match = nameRegex.exec(x.key[0]);
    if (match) {
      const name = match[1];
      const gender = match[2];
      const count = parseInt(x.values[0]);
      if (nameStats[name]) {
        nameStats[name][gender] = count;
      } else {
        allNames.push(name);
        nameStats[name] = {
          [gender]: count
        } 
      }
    }
  });

  console.log('Finalizing...');

  // Finally put it all together
  const allFemaleNames = [];
  const allMaleNames = [];
  const femaleNames = [];
  const maleNames = [];
  
  allNames.forEach(x => {
    const nameStat = nameStats[x];

    if (nameStat.K && nameStat.M) {
      if (nameStat.K > nameStat.M) {
        femaleNames.push(x);
      } else {
        maleNames.push(x);
      }
    }
    else {
      if (nameStat.K) {
        femaleNames.push(x);
      } else {
        maleNames.push(x);
      }
    }

    if (nameStat.K) {
      allFemaleNames.push(x);
    }
    if (nameStat.M) {
      allMaleNames.push(x);
    }
  });

  writeNamesToFile(allFemaleNames, 'swedish_female_names_with_duplicates.json');
  writeNamesToFile(allMaleNames, 'swedish_male_names_with_duplicates.json');
  writeNamesToFile(femaleNames, 'swedish_female_names.json');
  writeNamesToFile(maleNames, 'swedish_male_names.json');
}

/** Processes the response from the GET operation, which is
 * basically the API method description.
 */
// function processGetResponse(data) {
//   const nameRegex = /(.*)([K|M])/
//   const nameValues = data.variables[0].values;

//   const maleNames = [];
//   const femaleNames = [];
//   const maleMap = {};
//   nameValues.forEach(x => {
//     const match = nameRegex.exec(x);

//     if (match) {
//       const name = match[1];
//       const gender = match[2];
//       if (gender === 'K') {
//         femaleNames.push(name);
//       } else {
//         maleNames.push(name);
//         maleMap[name] = true;
//       }
//     }
//   });

//   writeNamesToFile(maleNames, 'swedish_male_names_with_duplicates.json');
//   writeNamesToFile(femaleNames, 'swedish_female_names_with_duplicates.json');

//   // Determine and write duplicates
//   const duplicateNames = [];
//   const queryValues = [];
//   femaleNames.forEach(x => {
//     if (maleMap[x]) {
//       duplicateNames.push(x);
//       queryValues.push(x + "K");
//       queryValues.push(x + "M");
//     }
//   });
//   writeNamesToFile(duplicateNames, 'duplicate_names.json');

//   // Construct a query to check the popularity of each name within its gender
//   const queryBody = {   
// 	  query: [
//       { code: "Tilltalsnamn", selection: { filter: "item", values: queryValues } },
//       { code: "Tid", selection: { filter: "item", values: [ "2016" ] } }
//     ],
//     response: { format: "json" } 
//   };

//   http.request({
//       host: 'http://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0001/BE0001TNamn10',
//       method: 'POST'
//     }, (response) => {
//     let body = '';
//     response.on('data', x => {
//       body += x;
//     });
//     response.on('end', () => {
//       const data = JSON.parse(body);
//       processDuplicateNamesResponse(maleNames, femaleNames, data);
//     });
//   });
// };

/** Writes a string array of names to a JSON file. */
function writeNamesToFile(names, fileName) {
  var file = fs.createWriteStream(fileName);
  file.write(JSON.stringify(names), (err, data) => {
    if (err) {
      console.log(err.message);
    } else {
      console.log(`Wrote ${names.length} names to file '${fileName}'`);
    }
  });
}
