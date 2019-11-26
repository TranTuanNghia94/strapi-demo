'use strict';

const _ = require('lodash');
/**
 * Read the documentation () to implement custom service functions
 */

module.exports = {

    add: async (values) => {
        // Extract values related to relational data.
        const relations = _.pick(values, Product.associations.map(ast => ast.alias));
        const data = _.omit(values, Product.associations.map(ast => ast.alias));

        // Create entry with no-relational data.
        const entry = await Product.create(data);

        // Create relational data and return the entry.
        return Product.updateRelations({ _id: entry.id, values: relations });
    },
};
