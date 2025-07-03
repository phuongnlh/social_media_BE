const crypto = require('crypto');
const fs = require('fs');

function genKeyPair() {
    const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        }
    });
    fs.writeFileSync('public_key.pem', keyPair.publicKey);
    fs.writeFileSync('private_key.pem', keyPair.privateKey);
    console.log("Created Keys Successfully!");
}

genKeyPair();