'use strict';

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 */

module.exports = {

  /**
   * Simple example.
   * Every monday at 1am.
   */

  // '0 1 * * 1': () => {
  //
  // }

  /**
   * Crawl instamart
   * Every day at 1 am
   */

  '10 9 * * *': () => {
    strapi.log.debug('start crawler cronjob');
    const crawler = require('./crawler/instamart/crawler.js');
    crawler.crawl();
  },

  /**
   * Crawl mydutyfree
   * Every day at 2 am
   */

  '15 9 * * *': () => {
    strapi.log.debug('start crawler cronjob');
    const crawler = require('./crawler/mydutyfree/crawler');
    crawler.crawl();
  },

  // '32 15 * * *': () => {
  //   const crawler = require('./crawler/mydutyfree/crawler.js');
  //   crawler.update(__dirname + '/crawler/mydutyfree/data/backup/products.json');
  // },


  '40 15 * * *': () => {
    const crawler = require('./crawler/instamart/crawler.js');
    crawler.update(__dirname + '/crawler/instamart/data/backup/products.json');
  }
};
