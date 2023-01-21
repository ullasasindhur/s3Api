const express = require("express");
const process = require("process");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const aws = require("aws-sdk");
aws.config.credentials = new aws.SharedIniFileCredentials();
if (aws.config.credentials.accessKeyId == undefined) {
  console.error("Please configure AWS CLI on your system");
  process.exit();
} else {
  console.log("Successfully loaded AWS Credentials");
}
const s3 = new aws.S3();

const port = 3000;
const allowedExtensions = ["pdf", "xlsx", "xls"];

const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((error, req, res, next) => {
  console.log("This is the rejected field ->", error.field);
});

app.get("/", (req, res) => {
  res.status(200).json({ Message: "Welcome to s3API" });
});

app.post("/upload", upload.single("key"), (req, res) => {
  console.log(req.file);
  if (req.file == undefined) {
    return res.status(400).send({ Message: "Missing file to upload" });
  }
  const bucket = "ullasasindhur";
  const key = req.file.originalname;
  if (allowedExtensions.includes(key.split(".").slice(-1)[0])) {
    const options = {
      Body: fs.createReadStream(req.file.path),
      Bucket: bucket,
      Key: key,
    };
    s3.upload(options, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        return res
          .status(201)
          .json({ Message: `File ${data.key} uploaded successfully` });
      }
    });
  } else {
    return res.status(501).send({
      Message: "Sorry, currently we are supporting only PDF/Excel files",
    });
  }
});

app.get("/download", (req, res) => {
  const key = req.query["key"];
  if (key == undefined) {
    return res.status(400).send({ Message: "Missing key parameter" });
  }
  const bucket = "ullasasindhur";
  if (allowedExtensions.includes(key.split(".").slice(-1)[0])) {
    const options = {
      Bucket: bucket,
      Key: key,
    };
    s3.getObject(options, (err, data) => {
      if (err) {
        return res.status(err.statusCode).send({ Message: err.message });
      } else {
        res.attachment(key);
        return res.send(data.Body);
      }
    });
  } else {
    return res.status(501).send({
      Message: "Sorry, currently we are supporting only PDF/Excel files",
    });
  }
});

app.use((error, req, res, next) => {
  res.status(400).send({ Message: "Missing key parameter" });
});

app.listen(port, () => {
  console.log(`Application running on ${port}`);
});
