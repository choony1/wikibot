﻿// cd /d D:\USB\cgi-bin\program\wiki && node 20190913.move_link.js

/*

 2019/9/13 8:59:40	初版試營運

 @see 20160923.modify_link.リンク元修正.js	20170828.search_and_replace.js	20161112.modify_category.js

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// Load wikiapi module.
const Wikiapi = require('wikiapi');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
let summary = '';
/** {String}section title of [[WP:BOTREQ]] */
let section_title = '';

/** {String|Number}revision id.  {String}'old/new' or {Number}new */
let diff_id = 0;
/** {Object}pairs to replace. {move_from_link: move_to_link} */
let move_configuration = {};

// ---------------------------------------------------------------------//

/** @inner */
const DELETE_PAGE = Symbol('DELETE_PAGE');


/*

文章名稱的改變，應考慮上下文的影響。例如：
# 是否應採用 [[new|old]]: using .keep_title
# 檢查重定向："株式会社[[リクルート]]" → "[[株式会社リクルート]]" instead of "株式会社[[リクルートホールディングス]]"

作業時檢查是否已經更改過、或者應該更改確沒辦法更改的情況。

作業完檢查リンク元

*/

// 2019/9/13 9:14:49
set_language('ja');
diff_id = 73931956;
section_title = '「大阪駅周辺バスのりば」改名に伴うリンク修正';
// 依頼内容:[[move_from_link]] → [[move_to_link]]への変更を依頼します。
move_configuration = { '大阪駅・梅田駅周辺バスのりば': '大阪駅周辺バスのりば' };


set_language('ja');
diff_id = 73650376;
section_title = 'リクルートの改名に伴うリンク修正';
move_configuration = {
	'リクルート': {
		move_from_link: 'リクルートホールディングス',
		keep_title: true
	}
};
// for 「株式会社リクルートホールディングス」の修正
diff_id = 74221568;
summary = '「株式会社リクルートホールディングス」の修正';
move_configuration = { 'リクルートホールディングス': '' };
//
diff_id = 74225967;
summary = 'リクルートをパイプリンクにする';
move_configuration = { 'リクルートホールディングス': '[[リクルートホールディングス|リクルート]]' };


diff_id = 73834996;
section_title = '「Category:時間別に分類したカテゴリ」のリンク元除去依頼';
summary = section_title.replace(/依頼$/, '');
move_configuration = { 'Category:時間別に分類したカテゴリ': 'Category:時間別分類' };

diff_id = 74082270;
section_title = 'Category:指標別分類系カテゴリ群の改名および貼り替え';
summary = '';
move_configuration = {
	'Category:言語別分類': {
		move_to_link: 'Category:言語別',
		do_move_page: { noredirect: true, movetalk: true }
	},
	//'Category:時間別分類': 'Category:時間別'
};
move_configuration = async (wiki) => {
	const page_data = await wiki.page('Category‐ノート:カテゴリを集めたカテゴリ (分類指標別)/「○○別に分類したカテゴリ」の一覧');
	let configuration = Object.create(null);
	const page_configuration = CeL.wiki.parse_configuration(page_data);
	for (let pair of page_configuration['○○別に分類したカテゴリ系の改名対象候補（143件）']) {
		if (pair[1].startsWith(':Category')) {
			// Remove header ":"
			configuration[pair[0].replace(/^:/g, '')] = {
				move_to_link: pair[1].replace(/^:/g, ''),
				//do_move_page: { noredirect: true, movetalk: true }
			};
		}
	}
	return configuration;
};

set_language('en');
set_language('commons');
diff_id = 364966353;
section_title = 'Remove promotional link';
summary = undefined;
move_configuration = {
	'Category:Photographs by David Falkner': {
		text_processor(wikitext) {
			// `Made with Repix (<a href="http://repix.it" rel="noreferrer nofollow">repix.it</a>)`
			return wikitext.replace(/[\s\n]*Made with Repix \([^)]*\)/g, '')
				.replace(/[\s\n]*<a\s+href=[^<>]+>[\s\S]+?<\/a\s*>/g, '');
		}
	}
};


set_language('ja');
diff_id = '74253402/74253450';
section_title = 'Portal:バス/画像一覧/年別 整理依頼';
summary = undefined;
move_configuration = {
	'Portal:バス/画像一覧/過去に掲載された写真/': {
		text_processor(wikitext, page_data) {
			/** {Array}頁面解析後的結構。 */
			const parsed = page_data.parse();
			let changed;
			const replace_to = '{{Portal:バス/画像一覧/年別}}';
			parsed.each('table', function (token, index, parent) {
				if (token.toString().includes('[[Portal:バス/画像一覧/過去に掲載された写真/')) {
					if (changed) {
						CeL.error('Had modified: ' + CeL.wiki.title_link_of(page_data));
						return;
					}
					parent[index] = replace_to;
					changed = true;
				}
			});
			if (!changed) {
				// verify
				if (!wikitext.includes(replace_to)) {
					CeL.error('Problematic page: ' + CeL.wiki.title_link_of(page_data));
				}
				return wikitext;
			}
			return parsed.toString();
		},
		list_types: 'prefixsearch',
	}
};


set_language('en');
set_language('commons');
diff_id = 365194769;
section_title = 'author field in info template';
summary = 'C.Suthorn wishes to change the author field of the files uploaded by himself';
move_configuration = {
	'Category:Files by C.Suthorn': {
		text_processor(wikitext, page_data) {
			const replace_from = '|author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]';
			const replace_to = '|author={{User:C.Suthorn/author}}';

			let includes_from = wikitext.includes(replace_from);

			if (includes_from) {
			} else if (wikitext.includes('|Author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]')) {
				includes_from = true;
				wikitext = wikitext.replace('|Author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]', replace_to);
			} else if (wikitext.includes('|photographer=[[User:C.Suthorn|C.Suthorn]]')) {
				includes_from = true;
				wikitext = wikitext.replace('|photographer=[[User:C.Suthorn|C.Suthorn]]', replace_to);
			}

			const includes_to = wikitext.includes(replace_to);

			if (includes_from && !includes_to) {
				// new page to replace
				return wikitext.replace(replace_from, replace_to);
			}
			if (!includes_from && includes_to) {
				// modified
			} else {
				CeL.error('Problematic page: ' + CeL.wiki.title_link_of(page_data));
			}
			return wikitext;
		},
		list_types: 'categorymembers',
		namespace: 'file',
		//17000+ too many logs
		log_to: null
	}
};

set_language('ja');
diff_id = 74434567;
section_title = 'Template:基礎情報 アナウンサーの引数変更';
summary = undefined;
move_configuration = {
	'Template:基礎情報_アナウンサー': {
		replace_parameters: {
			// | 家族 = → | 著名な家族 = に変更。
			家族: value => {
				return { 著名な家族: value };
			}
		}
	}
};

set_language('ja');
diff_id = 74458022;
section_title = 'Template:全国大学保健管理協会の除去';
summary = '';
move_configuration = {
	'Template:全国大学保健管理協会': DELETE_PAGE,
	'Template:日本養護教諭養成大学協議会': DELETE_PAGE,
};

set_language('ja');
diff_id = '74488219/74495273';
section_title = '「ナサケの女〜国税局査察官〜」記事とノートの内部リンク修正依頼';
summary = '';
move_configuration = {
	'ナサケの女 〜国税局査察官〜': 'ナサケの女〜国税局査察官〜',
	'ノート:ナサケの女 〜国税局査察官〜': 'ノート:ナサケの女〜国税局査察官〜'
};

// ---------------------------------------------------------------------//

function for_each_link(token, index, parent) {
	// token: [ page_name, section_title, displayed_text ]
	let page_name = CeL.wiki.normalize_title(token[0].toString());
	if (page_name !== this.move_from_link) {
		return;
	}

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (!token[2] && index > 0 && typeof parent[index - 1] === 'string' && parent[index - 1].endsWith('株式会社')) {
			//console.log(parent[index - 1]);
			// assert: "株式会社[[リクルートホールディングス]]"
			parent[index - 1] = parent[index - 1].replace('株式会社', '');
			parent[index] = '[[株式会社リクルート]]';
		}
		return;
	}

	// e.g., [[move_from_link]]
	//console.log(token);
	if (this.move_to_link === DELETE_PAGE) {
		CeL.assert(token[2] || !token[1] && this.move_from_ns === CeL.wiki.namespace('Main'));
		// 直接只使用 displayed_text。
		parent[index] = token[2] || token[0];

	} else if (!token[1] && token[2] === this.move_to_link) {
		// e.g., [[move_to_link|move to link]]
		token.pop();
		token[0] = this.move_to_link;

	} else {
		const matched = this.move_to_link.match(/^([^()]+) \([^()]+\)$/);
		if (matched) {
			// e.g., move_to_link: 'movie (1985)', 'movie (disambiguation)'
			//TODO
		}

		if (this.keep_title) {
			CeL.assert(this.move_from_ns === CeL.wiki.namespace('Main'));
			// 將原先的頁面名稱轉成顯示名稱。
			if (!token[1]) token[1] = '';
			// keep original title
			if (!token[2]) token[2] = token[0];
		}
		// 替換頁面。
		token[0] = this.move_to_link;
	}
}

const for_each_category = for_each_link;

// --------------------------------------------------------

function replace_link_parameter(value, parameter_name, template_token) {
	let move_from_link = this.move_from_link;
	let move_to_link = this.move_to_link;
	// 特別處理模板引數不加命名空間前綴的情況。
	if (template_token.name === 'Catlink') {
		move_from_link = move_from_link.replace(/^Category:/i, '');
		move_to_link = move_to_link.replace(/^Category:/i, '');
	}

	if (value && value.toString() === move_from_link) {
		// e.g., {{Main|move_from_link}}
		//console.log(template_token);
		return parameter_name + '=' + move_to_link;
	}

	if (!move_from_link.includes('#') && value && value.toString().startsWith(move_from_link + '#')) {
		// e.g., {{Main|move_from_link#section title}}
		return parameter_name + '=' + move_to_link + value.toString().slice(move_from_link.length);
	}
}

function check_link_parameter(template_token, parameter_name) {
	const attribute_text = template_token.parameters[parameter_name];
	if (!attribute_text) {
		if (parameter_name == 1) {
			CeL.warn('There is {{' + template_token.name + '}} without the first parameter.');
		}
		return;
	}

	CeL.wiki.parse.replace_parameter(template_token, parameter_name, replace_link_parameter.bind(this));
}

// templates that the first parament is displayed as link.
const first_link_template_hash = ''.split('|').to_hash();
// templates that ALL paraments are displayed as link.
const all_link_template_hash = 'Main|See|Seealso|See also|混同|Catlink'.split('|').to_hash();

/**
 * 換掉整個 parent[index] token 的情況。
 * @param {Array} parent
 * @param {Number} index
 * @param {String} replace_to
 */
function replace_token(parent, index, replace_to) {
	if (replace_to === DELETE_PAGE) {
		parent[index] = '';
		if (index + 1 < parent.length && typeof parent[index + 1] === 'string') {
			// 去除後方的空白 + 僅一個換行。 去除前方的空白或許較不合適？
			// e.g., "* list\n\n{{t1}}\n{{t2}}", remove "{{t1}}\n" → "* list\n\n{{t2}}"
			parent[index + 1] = parent[index + 1].replace(/^\s*\n/, '');
		}
	} else {
		parent[index] = replace_to;
	}
}

function for_each_template(token, index, parent) {

	if (token.name === this.move_from_page_name) {
		if (CeL.is_Object(this.replace_parameters)) {
			CeL.wiki.parse.replace_parameter(token, this.replace_parameters);
		}
		if (this.move_to_link === DELETE_PAGE) {
			replace_token(parent, index, DELETE_PAGE);
			return;
		}
		if (this.move_to_page_name && this.move_from_ns === CeL.wiki.namespace('Template')) {
			// 直接替換模板名稱。
			token[0] = this.move_to_page_name;
			return;
		}
	}

	if (token.name in first_link_template_hash) {
		check_link_parameter.call(this, token, 1);
		return;
	}

	if (token.name in all_link_template_hash) {
		for (let index = 1; index < token.length; index++) {
			check_link_parameter.call(this, token, index);
		}
		return;
	}

	// https://ja.wikipedia.org/wiki/Template:Main2
	if (this.move_to_link && token.name === 'Main2'
		// [4], [6], ...
		&& token[2] && CeL.wiki.normalize_title(token[2].toString()) === this.move_from_link) {
		// e.g., {{Main2|案内文|move_from_link}}
		//console.log(token);
		token[2] = this.move_to_link;
		return;
	}

	if (this.move_to_page_name && token.name === 'Pathnav') {
		// e.g., {{Pathnav|主要カテゴリ|…|move_from_link}}
		//console.log(token);
		if (this.move_from_ns === this.page_data.ns) {
			token.forEach(function (value, index) {
				if (index > 0 && CeL.wiki.normalize_title(value.toString()) === this.move_from_page_name) {
					token[index] = this.move_to_page_name;
				}
			}, this);
		}
		return;
	}

	return;

	// old:
	if (token.name === 'Template:Category:日本の都道府県/下位') {
		//e.g., [[Category:北海道の市町村別]]
		//{{Template:Category:日本の都道府県/下位|北海道|[[市町村]]別に分類したカテゴリ|市町村別に分類したカテゴリ|市町村|*}}
		token.forEach(function (value, index) {
			if (index === 0) return;
			value = CeL.wiki.normalize_title(value.toString());
			if (value.endsWith('別に分類したカテゴリ')) {
				token[index] = value.replace(/別に分類したカテゴリ$/, '別');
			}
		}, this);
		return;
	}

}

function for_each_page(page_data) {
	//console.log(page_data.revisions[0].slots.main);

	if (this.text_processor) {
		return this.text_processor(page_data.wikitext, page_data);
	}

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (page_data.revisions[0].user !== CeL.wiki.normalize_title(user_name)
			|| !page_data.wikitext.includes('株式会社[[リクルートホールディングス]]')) {
			return Wikiapi.skip_edit;
		}
	}

	if (false) {
		// for リクルートをパイプリンクにする
		if (page_data.revisions[0].user === CeL.wiki.normalize_title(user_name)) {
			return page_data.wikitext.replace(
				new RegExp(CeL.to_RegExp_pattern(CeL.wiki.title_link_of(this.move_from_link)), 'g'),
				this.move_to_link);
		}
		return Wikiapi.skip_edit;
	}


	/** {Array}頁面解析後的結構。 */
	const parsed = page_data.parse();
	//console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	this.page_data = page_data;

	if (this.move_to_link) {
		parsed.each('link', for_each_link.bind(this));
		if (this.move_from_ns === CeL.wiki.namespace('Category')) {
			parsed.each('category', for_each_category.bind(this));
		}
	}
	parsed.each('template', for_each_template.bind(this));

	// return wikitext modified.
	return parsed.toString();
}

// リンク 参照読み込み 転送ページ
const default_list_types = 'backlinks|embeddedin|redirects|categorymembers'.split('|');

/** {String}default namespace to search and replace */
const default_namespace = 'main|file|module|template|category';
//	'talk|template_talk|category_talk'

async function main_move_process(options) {
	let list_types = options.list_types || default_list_types;
	if (typeof list_types === 'string') {
		list_types = list_types.split('|');
	}
	let list_options = {
		namespace: options.namespace || default_namespace
	};

	// separate namespace and page name
	const matched = options.move_from_link.match(/^([^:]+):(.+)$/);
	const namespace = matched && CeL.wiki.namespace(matched[1]) || 0;
	options = {
		...options,
		move_from_ns: namespace,
		// page_name only
		move_from_page_name: namespace ? matched[2] : options.move_from_link,
	};
	if (options.move_to_link && options.move_to_link !== DELETE_PAGE) {
		// assert: typeof options.move_to_link === 'string'
		// get page_name only
		options.move_to_page_name = namespace ? options.move_to_link.replace(/^([^:]+):/, '') : options.move_to_link;
	}

	if (options.move_from_ns !== CeL.wiki.namespace('Category')) {
		list_types = list_types.filter(type => type !== 'categorymembers');
	}

	let page_list = [];
	CeL.info('main_move_process: Get types: ' + list_types);
	// Can not use `list_types.forEach(async type => ...)`
	for (let type of list_types) {
		page_list.append(await wiki[type](options.move_from_link, list_options));
	}

	page_list = page_list.filter((page_data) => {
		return page_data.ns !== CeL.wiki.namespace('Wikipedia')
			&& page_data.ns !== CeL.wiki.namespace('User')
			//&& !page_data.title.includes('/過去ログ')
			;
	}).unique(page_data => page_data.title);
	//console.log(page_list);

	await wiki.for_each_page(
		page_list.slice(0, 1)
		,
		for_each_page.bind(options),
		{
			// for 「株式会社リクルートホールディングス」の修正
			// for リクルートをパイプリンクにする
			//page_options: { rvprop: 'ids|content|timestamp|user' },
			log_to: 'log_to' in options ? options.log_to : log_to,
			summary
		});
}

async function prepare_operation() {
	const _summary = typeof summary === 'string' ? summary : section_title;
	section_title = section_title ? '#' + section_title : '';

	await wiki.login(user_name, user_password, use_language);

	if (typeof move_configuration === 'function') {
		move_configuration = await move_configuration(wiki);
		//console.log(move_configuration);
		//console.log(Object.keys(move_configuration));
		//throw Object.keys(move_configuration).length;
	}

	//Object.entries(move_configuration).forEach(main_move_process);
	for (let pair of Object.entries(move_configuration)) {
		const [move_from_link, move_to_link] = [CeL.wiki.normalize_title(pair[0]), pair[1]];
		let options = CeL.is_Object(move_to_link)
			? move_to_link.move_from_link ? move_to_link : { move_from_link, ...move_to_link }
			//assert: typeof move_to_link === 'string'
			: { move_from_link, move_to_link };

		const _log_to = 'log_to' in options ? options.log_to : log_to;
		if (_summary) {
			summary = _summary;
		} else if (options.move_to_link === DELETE_PAGE) {
			summary = CeL.wiki.title_link_of(move_from_link) + 'の除去';
		} else {
			summary = CeL.wiki.title_link_of(options.move_to_link)
				// の記事名変更に伴うリンクの修正 カテゴリ変更依頼
				+ '改名に伴うリンク修正';
		}
		summary = CeL.wiki.title_link_of(diff_id ? 'Special:Diff/' + diff_id + section_title : 'WP:BOTREQ',
			use_language === 'zh' ? '機器人作業請求'
				: use_language === 'ja' ? 'Bot作業依頼' : 'Bot request')
			+ ': ' + summary
			+ (_log_to ? ' - ' + CeL.wiki.title_link_of(_log_to, 'log') : '');

		if (options.do_move_page) {
			// 作業前先移動原頁面。
			options.do_move_page = { reason: summary, ...options.do_move_page };
			try {
				const page_data = await wiki.page(move_from_link);
				if (!page_data.missing) {
					// カテゴリの改名も依頼に含まれている
					await wiki.move_to(options.move_to_link, options.do_move_page);
				}
			} catch (e) {
				if (e.code !== 'missingtitle' && e.code !== 'articleexists') {
					if (e.code) {
						CeL.error('[' + e.code + '] ' + e.info);
					} else {
						console.error(e);
					}
					//continue;
				}
			}
		}

		await main_move_process(options);
	}
}

(async () => {
	await prepare_operation();
})();