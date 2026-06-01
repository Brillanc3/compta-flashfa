'use strict';

// Tout BigInt sérialisé en string côté JSON — chargé en premier par tchatv2.routes.js
if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}

module.exports = {};
