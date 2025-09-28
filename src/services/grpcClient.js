const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync("src/proto/comment_censor.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);

const client = new proto.comment_censor.CommentCensorService(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

module.exports = client;
