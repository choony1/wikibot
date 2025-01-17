﻿/*

2019/12/2 20:2:11	初版試營運

@see [[w:zh:Wikipedia:互助客栈/其他/存档/2019年11月#有关于公共字词转换组的若干讨论]]

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.template_functions');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const main_category = 'Category:公共轉換組模板';
const report_base = 'Wikipedia:字詞轉換處理/公共轉換組/';
const conversion_list_page = report_base + '各頁面包含字詞';
const duplicated_report_page = report_base + '重複字詞報告';
const conversion_table_file = 'conversion_table.' + use_language + '.json';

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	// TODO: add 內置轉換列表
	// https://doc.wikimedia.org/mediawiki-core/master/php/ZhConversion_8php_source.html
	await check_system_pages();
	await check_CGroup_pages();

	const pages = await write_conversion_list();

	const items = await write_duplicated_report();

	CeL.write_file(conversion_table_file, conversion_table);
	CeL.info(pages + ' pages, ' + items + ' items.');
	// Array.isArray(conversion_of_group.Popes);
	// console.log(conversion_of_group.Popes);

	// await wiki.for_each_page(await wiki.embeddedin('Template:NoteTA'), for_NoteTA_article);

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

// 全局轉換表
async function check_system_pages() {
	// get all subpage links of the form
	// [[MediaWiki:Conversiontable/zh-xx/...|...]]
	const conversion_group_list = await wiki.prefixsearch('Mediawiki:Conversiontable/');
	CeL.info('Traversal ' + conversion_group_list.length + ' system pages...');
	// console.log(conversion_group);
	await wiki.for_each_page(conversion_group_list, for_each_conversion_group_page, { index: 0, conversion_group_list });
}

function get_group_name_of_page(page_data) {
	var group_name = page_data.title.match(/^(?:[^:]+):(?:[^\/]+\/)?(.+)$/);
	if (group_name) {
		return group_name[1];
	}
}

// 公共轉換組
async function check_CGroup_pages() {
	const conversion_group = Object.create(null);
	const category_tree = await wiki.category_tree(main_category, {
		namespace: [NS_Module, NS_Template],
	});
	// console.log(page_list.subcategories);

	const deprecated_pages = Object.create(null);
	function add_page(page_list, deprecated) {
		page_list.forEach(function (page_data) {
			const group_name = get_group_name_of_page(page_data);
			if (!group_name) {
				console.error(page_data);
				return;
			}

			if (deprecated) {
				deprecated_pages[group_name] = page_data;
				// Will be deleted later.
				if (false && conversion_group[group_name]
					&& conversion_group[group_name].title === page_data.title) {
					delete conversion_group[group_name];
				}
				return;
			}

			if (!conversion_group[group_name]
				// module 的優先度高於 template。
				|| page_data.ns === NS_Module) {
				conversion_group[group_name] = page_data;
			}
		});
		if (page_list.subcategories) {
			for (let [subcategory, sub_list] of Object.entries(page_list.subcategories)) {
				// CeL.info('Add Category:' + subcategory + '...');
				// console.log(sub_list);
				add_page(sub_list, subcategory.includes('已停用') || deprecated);
			}
		}
	}
	add_page(category_tree);

	for (let [name, page_data] of Object.entries(deprecated_pages)) {
		if (conversion_group[name] && conversion_group[name].title === page_data.title)
			delete conversion_group[name];
	}
	// console.log(deprecated_pages);
	// free
	// deprecated_pages = null;

	const conversion_group_list = Object.values(conversion_group)
		.filter(page_data => page_data.ns === NS_MediaWiki
			|| page_data.ns === NS_Module
			|| page_data.ns === NS_Template);
	CeL.info('Traversal ' + conversion_group_list.length + ' CGroup pages...');
	// console.log(conversion_group);
	await wiki.for_each_page(conversion_group_list, for_each_conversion_group_page, { index: 0, conversion_group_list });
}

// ----------------------------------------------------------------------------

const KEY_page = Symbol('page');

// conversion_table[vocabulary] = {'zh-tw':'vocabulary', ...}
const conversion_table = Object.create(null);

// conversion_of_page[page_title][vocabulary] = {'zh-tw':'vocabulary', ...};
const conversion_of_page = Object.create(null);
// conversion_of_group[group_name][vocabulary] = {'zh-tw':'vocabulary', ...};
const conversion_of_group = Object.create(null);

// duplicated_items[vocabulary] = [ pages ]
const duplicated_items = Object.create(null);

// 後出現者為準。
function add_duplicated(vocabulary, from_conversion, to_conversion) {
	if (CeL.is_debug()) {
		CeL.warn('add_duplicated: Overwrite ' + JSON.stringify(vocabulary));
		console.log(from_conversion);
		CeL.info(vocabulary + ' →');
		console.log(to_conversion);
	} else if (false) {
		CeL.warn('add_duplicated: ' + JSON.stringify(vocabulary)
			+ ': ' + from_conversion[KEY_page]
			+ ' → ' + to_conversion[KEY_page]);
	}

	if (from_conversion.duplicate_list) {
		to_conversion.duplicate_list = from_conversion.duplicate_list;
		delete from_conversion.duplicate_list;
	} else {
		to_conversion.duplicate_list = [];
	}
	to_conversion.duplicate_list.push(from_conversion);

	if (duplicated_items[vocabulary]) {
		duplicated_items[vocabulary].push(
			CeL.wiki.title_link_of(to_conversion[KEY_page])
		);
	} else {
		duplicated_items[vocabulary] = [
			CeL.wiki.title_link_of(from_conversion[KEY_page]),
			CeL.wiki.title_link_of(to_conversion[KEY_page])
		];
	}
}

function add_conversion(item, from_page) {
	// console.log(item);
	// console.log(from_page);
	if (!item || item.type !== 'item')
		return;

	const parsed = CeL.wiki.parse('-{H|' + item.rule + '}-',
		// 當作 page，取得 .conversion_table。
		'with_properties');
	let table = parsed.conversion_table;
	if (!table) {
		const converted = parsed.converted;
		if (typeof converted === 'string') {
			/**
			 * e.g.,<code>

			// { type: 'item', original: 'Anti-gravity', rule: '反重力' }
			parsed = CeL.wiki.parse("-{H|反重力}-", 'with_properties');

			</code>
			 */
			table = { [converted]: { converted } };
		} else {
			/**
			 * e.g.,<code>

			parsed = CeL.wiki.parse("-{H|zh-cn:<sup>-9</sup>米; zh-hk:<sup>-9</sup>米; zh-sg:<sup>-9</sup>米; zh-mo:<sup>-9</sup>米; zh-tw:<sup>-9</sup>公尺;}-", 'with_properties');

			</code>
			 */
			CeL.warn('add_conversion: Can not parse item:');
			console.log(item);
			console.log(parsed);
			return;
		}
	}
	// console.log(table);

	for (let [vocabulary, conv] of Object.entries(table)) {
		if (conv.conversion)
			conv = conv.conversion;
		// console.log([vocabulary, conv]);

		if (!conversion_of_page[from_page.title]) {
			conversion_of_group[get_group_name_of_page(from_page)]
				//
				= conversion_of_page[from_page.title] = [];
		}
		// 後出現者為準。
		conversion_of_page[from_page.title][vocabulary] = conv;

		conv[KEY_page] = from_page.title;
		if ((vocabulary in conversion_table)
			&& conversion_table[vocabulary][KEY_page] !== conv[KEY_page]) {
			add_duplicated(vocabulary, conversion_table[vocabulary], conv);
		}
		// 後出現者為準。
		conversion_table[vocabulary] = conv;
	}
}

const NS_MediaWiki = CeL.wiki.namespace('MediaWiki');
const NS_Module = CeL.wiki.namespace('Module');
const NS_Template = CeL.wiki.namespace('Template');

async function for_each_conversion_group_page(page_data) {
	// assert: page_data.ns === NS_MediaWiki || page_data.ns === NS_Module ||
	// page_data.ns === NS_Template

	const conversion_item_list = CeL.wiki.template_functions.parse_conversion_item(page_data);
	conversion_item_list.forEach(item => add_conversion(item, page_data));
	CeL.info(++this.index + '/' + this.conversion_group_list.length
		+ ': ' + CeL.wiki.title_link_of(page_data) + ': ' + conversion_item_list.length + ' items.');
}

// ----------------------------------------------------------------------------

function ascending(a, b) {
	a = a[0];
	b = b[0];
	return a < b ? -1 : a > b ? 1 : 0;
}

async function write_conversion_list() {
	CeL.info('Writing report to ' + CeL.wiki.title_link_of(conversion_list_page) + '...');
	const report_lines = [];
	for (let [page_title, conversion_list] of Object.entries(conversion_of_page)) {
		conversion_list = Object.keys(conversion_list).sort()
			// needless: .unique()
			;
		report_lines.push([CeL.wiki.title_link_of(page_title) + ' (' + conversion_list.length + ')',
		'data-sort-value="' + conversion_list.length + '"|' + conversion_list.join('; ')]);
	}
	const count = report_lines.length;
	report_lines.sort(ascending);
	report_lines.unshift('公共轉換組頁面|定義的詞彙'.split('|'));
	await wiki.edit_page(conversion_list_page,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '總共' + count + '個公共轉換組頁面。\n'
		+ '* 本條目會定期更新，毋須手動修正。\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* 產生時間：<onlyinclude>~~~~~</onlyinclude>\n\n'
		+ CeL.wiki.array_to_table(report_lines, {
			'class': "wikitable sortable"
		}), {
		nocreate: 1,
		summary: count + '個公共轉換組頁面'
	});
	return count;
}

// generate_report()
async function write_duplicated_report() {
	CeL.info('Writing report to ' + CeL.wiki.title_link_of(duplicated_report_page) + '...');
	const report_lines = [];
	for (let [vocabulary, page_list] of Object.entries(duplicated_items)) {
		page_list = page_list.sort().unique();
		report_lines.push([vocabulary, 'data-sort-value="' + page_list.length + '"|' + page_list.length + ': ' + page_list.join(', ')]);
	}

	const report_count = report_lines.length;
	let report_wikitext;
	if (report_count > 0) {
		report_lines.sort(ascending);
		report_lines.unshift('重複出現的詞彙|定義於公共轉換組頁面'.split('|'));
		report_wikitext = CeL.wiki.array_to_table(report_lines, {
			'class': "wikitable sortable"
		});
	} else {
		report_wikitext = "* '''太好了！無特殊頁面。'''";
	}

	await wiki.edit_page(duplicated_report_page,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ `出現在多個不同的公共轉換組中的詞彙：${report_count}個詞彙。\n`
		+ '* 本條目會定期更新，毋須手動修正。\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* 產生時間：<onlyinclude>~~~~~</onlyinclude>\n\n<!-- report begin -->\n'
		+ report_wikitext + '\n<!-- report end -->', {
		bot: 1,
		nocreate: 1,
		summary: report_count + '個重複詞彙'
	});
	return report_count;
}

// ----------------------------------------------------------------------------

// 去除與公共轉換組重複的轉換規則
// 去除與全文轉換重複的內文轉換
async function for_NoteTA_article(page_data) {
	// conversion_hash[conversion] = [ token ];
	const conversion_hash = Object.create(null);
	const conversion_item_list = CeL.wiki.template_functions.parse_conversion_item(page_data);
	//console.log([page_data.title, conversion_item_list]);

	const parsed = page_data.parse();
	parsed.each('Template:NoteTA', token => {
		console.log([page_data.title, conversion_item_list, token.convertion_list]);
	});
}
