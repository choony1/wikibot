﻿// /usr/bin/jsub -N cron-tools.cewbot-env -once -quiet /usr/bin/node /data/project/cewbot/wikibot/archive/env.js

/*

 2016/6/8 20:32:14

 */

'use strict';

console
		.log('============================================================================');
console.log((new Date).toISOString());
console.log('global');
console.log(global);

console.log('------------------------------------------------------------');
console.log('process');
console.log(process);
console.log('process.env');
console.log(process.env);

// Load CeJS library and modules.
require('../wiki loader.js');

console
		.log('--------------------------------------------------------------------------------');
console.log('CeJS loaded. global:');
console.log(global);

console.log('------------------------------------------------------------');
console.log('CeL.env.argv');
console.log(CeL.env.argv);
console.log('CeL.env.arg_gash');
console.log(CeL.env.arg_gash);
