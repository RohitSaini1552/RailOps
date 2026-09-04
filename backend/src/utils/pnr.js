const crypto = require('crypto');

function generatePnr() {
  return `PNR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

module.exports = {
  generatePnr
};
