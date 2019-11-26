'use strict';
const slug = require('slug');

/**
 * 
 * @param {Name} str 
 * @return {permalink}
 */
function toCode(str) {
    return slug(str, { lower: true })
    // return str
    //     .trim()
    //     .toLowerCase()
    //     .normalize("NFD")
    //     .replace(/[\u0300-\u036f]/g, "")
    //     .replace(/đ/g, "d")
    //     .replace(/Đ/g, "D")
    //     .replace(/[.,*+?^${}()|[\]\\_/ %-]+/g, '-');
}

module.exports = {
    toCode
}