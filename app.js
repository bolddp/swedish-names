var http = require('http');
var fs = require('fs');

const nameRegex = /(.*)([K|M])/

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

function processGetResponse(getResponseValues) {
  // We start by finding the duplicates, since we need to send a
  // query to get the name counts for them.
  const maleMap = {};
  const femaleNames = [];
  getResponseValues.forEach(x => {
    const match = nameRegex.exec(x);
    if (match) {
      const name = match[1];
      const gender = match[2];
      if (gender === 'M') {
        maleMap[name] = true;
      } else {
        femaleNames.push(name);
      }
    }
  });

  const duplicateNames = [];
  const duplicateMap = {};
  const postQueryValues = [];
  femaleNames.forEach(x => {
    if (maleMap[x]) {
      duplicateNames.push(x);
      duplicateMap[x] = true;

      postQueryValues.push(`${x}K`);
      postQueryValues.push(`${x}M`);
    }
  });

  writeNamesToFile(duplicateNames, 'duplicate_names.json');

  const postData = JSON.stringify({   
	  query: [
      { code: "Tilltalsnamn", selection: { filter: "item", values: postQueryValues } },
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
        processPostResponse(getResponseValues, data);
      });
    }
  );

  postRequest.write(postData);
  postRequest.end();
};

function processPostResponse(getResponseValues, postResponse) {
  console.log('Processing POST data');
  const nameRegex = /(.*)([K|M])/
  const nameStats = {};
  postResponse.data.forEach(x => {
    const match = nameRegex.exec(x.key[0]);
    if (match) {
      const name = match[1];
      const gender = match[2];
      const count = parseInt(x.values[0]);
      if (nameStats[name]) {
        nameStats[name][gender] = count;
      } else {
        nameStats[name] = {
          [gender]: count
        } 
      }
    }
  });

  // Now we have a map with female and male name counts for all duplicates
  const femaleNames = [];
  const femaleNamesWithDuplicates = [];
  const maleNames = [];
  const maleNamesWithDuplicates = [];

  getResponseValues.forEach(x => {
    const match = nameRegex.exec(x);
    if (match) {
      const name = match[1];
      let gender = match[2];
      // Push it to lists with duplicates without further analysis
      if (gender === 'M') {
        maleNamesWithDuplicates.push(name);
      } else if (gender === 'K') {
        femaleNamesWithDuplicates.push(name);
      }

      // Is it a duplicate? Then should it be pushed?
      if (nameStats[name]) {
        const nameStat = nameStats[name];
        // Should it be ignored?
        if (gender === 'K') {
          if (nameStat.K <= nameStat.M) {
            gender = '';
          }
        } else {
          if (nameStat.K > nameStat.M) {
            gender = '';
          }
        }
      }

      if (gender === 'M') {
        maleNames.push(name);
      }
      if (gender === 'K') {
        femaleNames.push(name);
      }
    }
  });

  writeNamesToFile(femaleNames, 'swedish_female_names.json');
  writeNamesToFile(femaleNamesWithDuplicates, 'swedish_female_names_with_duplicates.json');
  writeNamesToFile(maleNames, 'swedish_male_names.json');
  writeNamesToFile(maleNamesWithDuplicates, 'swedish_male_names_with_duplicates.json');
}

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
