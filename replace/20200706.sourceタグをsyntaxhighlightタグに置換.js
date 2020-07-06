﻿'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	no_notice: true,
}, {
	'Category:非推奨のsourceタグを使用しているページ': {
		//對於追蹤類別 [[Category:Tracking categories]]，不會算入 [[Template:name/doc]]。例如 [[Category:Pages using deprecated source tags]]
		is_tracking_category: true,
		// for debug
		//page_list: ['HTML5'],
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');
			//console.log(parsed.slice(200));
			//throw new Error('debug');

			let changed;
			parsed.each('tag', token => {
				if (token.tag !== 'source')
					return;
				changed = true;
				//console.log(token);
				token.tag = 'syntaxhighlight';
			});
			if (changed)
				return parsed.toString();
		},
	},
});
