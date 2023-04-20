const core = require('@actions/core');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');
const slash = require('slash').default;
const klawSync = require('klaw-sync');
const { lookup } = require('mime-types');

const AWS_KEY_ID = core.getInput('AWS_KEY_ID', {
  required: true,
});
const SECRET_ACCESS_KEY = core.getInput('AWS_SECRET_ACCESS_KEY', {
  required: true,
});
const BUCKET = core.getInput('AWS_BUCKET', {
  required: true,
});
const SOURCE_DIR = core.getInput('SOURCE_DIR', {
  required: true,
});
const DESTINATION_DIR = core.getInput('DESTINATION_DIR', {
  required: false,
});
const ENDPOINT = core.getInput('ENDPOINT', {
  required: false,
});

const s3options = {
  accessKeyId: AWS_KEY_ID,
  secretAccessKey: SECRET_ACCESS_KEY,
};

if (ENDPOINT) {
  s3options.endpoint = ENDPOINT;
}

const s3 = new S3(s3options);
const destinationDir = DESTINATION_DIR === '/' ? shortid() : DESTINATION_DIR;
const paths = klawSync(SOURCE_DIR, {
  nodir: true,
});

function upload(params) {
  return new Promise((resolve) => {
    s3.upload(params, (err, data) => {
      if (err) core.error(err);
      core.info(`uploaded - ${data.Key}`);
      core.info(`located - ${data.Location}`);
      resolve(data.Location);
    });
  });
}

function run() {
  const sourceDir = slash(path.join(process.cwd(), SOURCE_DIR));
  return Promise.all(
    paths.map((p) => {
      const fileStream = fs.createReadStream(p.path);
      const bucketPath = slash(
        path.join(destinationDir, slash(path.relative(sourceDir, p.path)))
      );
      const params = {
        Bucket: BUCKET,
        Body: fileStream,
        Key: bucketPath,
        ContentType: lookup(p.path) || 'text/plain',
      };
      return upload(params);
    })
  );
}

run()
  .then((locations) => {
    core.info(`object key - ${destinationDir}`);
    core.info(`object locations - ${locations}`);
    core.setOutput('object_key', destinationDir);
    core.setOutput('object_locations', locations);
  })
  .catch((err) => {
    core.error(err);
    core.setFailed(err.message);
  });
