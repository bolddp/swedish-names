var http = require('http');
var fs = require('fs');

// Get the API method description
http.get('http://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0001/BE0001TNamn10', (response) => {
  let body = '';
  response.on('data', x => {
    body += x;
  });
  response.on('end', () => {
    const data = JSON.parse(body);
    processGetResponse(data);
  });
});

/** Processes the response from the GET operation, which is
 * basically the API method description.
 */
function processGetResponse(data) {
  const nameRegex = /(.*?)([K|M])/

  const maleNames = [];
  const femaleNames = [];
  const nameValues = data.variables[0].values;
  nameValues.forEach(x => {
    const match = nameRegex.exec(x);
    const name = match[1];
    const gender = match[2];
    if (gender === 'K') {
      femaleNames.push(name);
    } else {
      maleNames.push(name);
    }
  });

  writeFile(maleNames, 'swedish_male_names.json');
  writeFile(femaleNames, 'swedish_female_names.json');
  


  // const result = [];
  // const nameValues = data.variables[0].values;
  // nameValues.forEach(x => {
  //   result.push(x);
  // });
}

function writeFile(names, fileName) {
  var file = fs.createWriteStream(fileName);
  file.write(JSON.stringify(names), (err, data) => {
    if (err) {
      console.log(err.message);
    } else {
      console.log(`Wrote ${names.length} names to file '${fileName}'`);
    }
  });
}
