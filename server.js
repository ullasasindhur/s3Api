const express = require("express");
const process = require("process");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
require("dotenv").config();

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.BUCKET_NAME;
const allowedExtensions = ["pdf", "xlsx", "xls"];

const port = 3000;
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({ Message: "Welcome to s3API" });
});

app.post("/upload", upload.single("key"), async (req, res) => {
  if (req.file == undefined) {
    return res.status(400).send({ Message: "Missing file to upload" });
  }
  const key = req.file.originalname;
  if (allowedExtensions.includes(key.split(".").pop())) {
    const options = {
      Body: fs.createReadStream(req.file.path),
      Bucket: bucket,
      Key: key,
    };
    try {
      await s3Client.send(new PutObjectCommand(options));
      return res
        .status(201)
        .json({ Message: `File ${options.Key} uploaded successfully` });
    } catch (err) {
      return res
        .status(err.$metadata.httpStatusCode)
        .send({ Message: err.Code });
    }
  } else {
    return res.status(501).send({
      Message: "Sorry, currently we are supporting only PDF/Excel files",
    });
  }
});

app.get("/download", async (req, res) => {
  const key = req.query["key"];
  if (key == undefined) {
    return res.status(400).send({ Message: "Missing key parameter" });
  }
  if (allowedExtensions.includes(key.split(".").pop())) {
    const options = {
      Bucket: bucket,
      Key: key,
    };
    try {
      const data = await s3Client.send(new GetObjectCommand(options));
      res.attachment(key);
      res.send(Buffer.concat(await data.Body.toArray()));
    } catch (err) {
      return res
        .status(err.$metadata.httpStatusCode)
        .send({ Message: err.Code });
    }
  } else {
    return res.status(501).send({
      Message: "Sorry, currently we are supporting only PDF/Excel files",
    });
  }
});

app.get("/list-objects", async (req, res) => {
  const key = req.query["key"];
  if (key == undefined || key == "") {
    return res.status(400).send({ Message: "Missing key parameter" });
  }
  const options = {
    Bucket: bucket,
    Prefix: key,
  };
  try {
    const data = await s3Client.send(new ListObjectsV2Command(options));
    const selectedKeys = ["Key", "Size", "LastModified"];
    const tempData = data.Contents;
    if (tempData == undefined || tempData[0].Key == key + "/") {
      return res.status(404).send({ Message: `No data available at ${key}` });
    }
    const filteredData = tempData.map((element) => {
      const filterdElement = {};
      selectedKeys.forEach((key) => (filterdElement[key] = element[key]));
      return filterdElement;
    });
    return res.status(200).send(filteredData);
  } catch (err) {
    return res.status(err.$metadata.httpStatusCode).send({ Message: err.Code });
  }
});

app.delete("/delete", async (req, res) => {
  const key = req.query["key"];
  if (key == undefined || key == "") {
    return res.status(400).send({ Message: "Missing key parameter" });
  }
  if (allowedExtensions.includes(key.split(".").pop())) {
    const options = {
      Bucket: bucket,
      Key: key,
    };
    try {
      await s3Client.send(new DeleteObjectCommand(options));
      return res
        .status(200)
        .send({ Message: `Successfully Deleted the file ${key}` });
    } catch (err) {
      return res
        .status(err.$metadata.httpStatusCode)
        .send({ Message: err.Code });
    }
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
