const express = require("express");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const requests = require("request");
const stream = require("stream");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
function streamToString(stream, cb) {
  const chunks = [];
  stream.on("data", (e) => {
    chunks.push(e.toString());
  });
  stream.on("end", () => {
    cb(chunks.join(""));
  });
}
// https://expressjs.com/en/starter/basic-routing.html
app.post("/", (request, response) => {
  let csv = { ...request.body };
  csv = csv.csv;
  //csv = JSON.parse(csv);
  if (!csv || !csv.url) {
    response.status(400).json({
      message: "Please provide input data in the right format",
    });
  } else {
    function downloadCSV(url, path) {
      return requests(csv.url).pipe(fs.createWriteStream(path));
    }

    const getCSVData = (url) => {
      new Promise((resolve, reject) => {
        downloadCSV(url, "data.csv")
          .on("error", (err) => {
            console.log(err);
            response.json({
              message: "Unable to download CSV from URL",
            });
            reject(`Unable to download csv`);
          })
          .on("finish", function () {
            let csvData;
            let data = fs.readFileSync("./data.csv", { encoding: "utf-8" });
            //console.log(data);
            csvData = data.split("\n");
            if (csvData[csvData.length - 1] === "") {
              csvData.pop();
            }

            const getHeaders = (csvData) => {
              let headers = csvData[0];
              headers = headers.replace("\r", "");
              headers = headers.split(",");
              return headers;
            };
            let csvHeaders = getHeaders(csvData);
            for (let i = 0; i < csvHeaders.length; i++) {
              csvHeaders[i] = csvHeaders[i].trim();
            }
            console.log(csvHeaders);

            let csvRawBody = csvData.slice(1);
            csvRawBody = csvRawBody.map((csv) => csv.replace("\r", ""));
            //console.log(csvRawBody);
            const getBody = (csvRawBody) => {
              let data = [];
              function operate(csvRawBody) {
                if (csvRawBody.length === 0) return;
                let value = csvRawBody[0].split(",");
                for (let i = 0; i < value.length; i++) {
                  value[i] = value[i].trim();
                }
                value = value.join(" ");
                data.push(value);
                operate(csvRawBody.slice(1));
              }
              operate(csvRawBody);
              if (data[data.length - 1] == "") data.pop();
              function trimWhiteSpace(data) {
                if (data.length === 0) return;
                data[0] = data[0].trim();
                trimWhiteSpace(data.slice(1));
              }
              trimWhiteSpace(data);
              return data;
            };
            const csvBody = getBody(csvRawBody);
            console.log(csvBody);

            const validateCSV = (csvBody, csvHeadersLength) => {
              if (csvBody.length === 0) return true;
              //console.log(csvBody[0].split(' ').length, csvHeadersLength, csvBody.slice(1))
              if (csvBody[0].split(" ").length !== csvHeadersLength)
                return false;
              return validateCSV(csvBody.slice(1), csvHeadersLength);
            };
            const isValid = validateCSV(csvBody, csvHeaders.length);
            //if (!isValid) return "Invalid CSV File Format!";
            console.log(isValid);
            if (!isValid) {
              response.status(400).json({
                message: "Invalid CSV file format",
              });
            } else {
              const generateJSONObjectInArray = (
                csvHeaders,
                csvBody,
                fields
              ) => {
                let response = [];
                let returnData;
                if (fields == undefined || fields == null) {
                  function createObject(csvHeaders, csvBody) {
                    //console.log(csvBody.length)
                    if (csvBody.length === 0) return;
                    let data = {};
                    let arr = csvBody[0].split(" ");
                    //console.log(arr);
                    for (let i = 0; i < arr.length; i++) {
                      data[csvHeaders[i]] = arr[i];
                    }
                    response.push(data);
                    data = {};
                    arr = undefined;
                    createObject(csvHeaders, csvBody.slice(1));
                  }
                  createObject(csvHeaders, csvBody);
                  returnData = {
                    conversion_key: crypto.randomBytes(32).toString("hex"),
                    json: response,
                  };
                  console.log(returnData);
                  return returnData;
                } else {
                  function createTailoredObject(csvHeaders, csvBody, fields) {
                    if (csvBody.length === 0) return;
                    let data = {};
                    let fieldData = fields.map((val) => {
                      if (csvHeaders.includes(val)) {
                        return val;
                      }
                    });
                    //console.log(fieldData);
                    let arr = csvBody[0].split(" ");
                    for (let i = 0; i < arr.length; i++) {
                      data[csvHeaders[i]] = arr[i];
                      //data.fieldData[i] = csvBody[0][csvHeaders.indexOf(fieldData[i])];
                    }
                    for (let property in data) {
                      if (fieldData.includes(property) === false) {
                        delete data[property];
                      }
                    }
                    response.push(data);
                    data = {};
                    arr = undefined;
                    createTailoredObject(csvHeaders, csvBody.slice(1), fields);
                  }
                  createTailoredObject(csvHeaders, csvBody, fields);
                  returnData = {
                    conversion_key: crypto.randomBytes(32).toString("hex"),
                    json: response,
                  };
                  console.log(returnData);
                  return returnData;
                }
              };
              if (csv.select_fields) {
                const csvJSON = generateJSONObjectInArray(
                  csvHeaders,
                  csvBody,
                  csv.select_fields
                );
                response.status(200).json(csvJSON);
              } else {
                const csvJSON = generateJSONObjectInArray(csvHeaders, csvBody);
                response.status(200).json(csvJSON);
              }
            }
            resolve(csvData);
          });
      });
    };
    getCSVData(csv.url);
  }
});

// listen for requests :)
const listener = app.listen(3000, () => {
  console.log("Your app is listening on port " + 3000);
});
