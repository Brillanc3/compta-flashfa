// Convertit récursivement tous les BigInt en string
function toSafeJson(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        )
    );
}

module.exports = { toSafeJson };
