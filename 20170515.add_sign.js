﻿// (cd ~/wikibot && date && hostname && nohup time node 20170515.add_sign.js; date) >> modify_link/log &

/*


 [[User talk:蘭斯特/TWA]]
 應掛上{{bot}}或改到[[User:蘭斯特/TWA]]

 // TODO: id error!!!

 2017/5/15 21:30:19	初版試營運。
 完成。正式運用。

 工作原理:
 # wiki.listen(): 監視最近更改的頁面。
 # wiki.listen(): 取得頁面資料。
 # filter_row(): 從頁面資訊做初步的篩選: 以討論頁面為主。
 # for_each_row(): 解析頁面結構。比較頁面修訂差異。
 # check_diff_pair(): 對於頁面每個修改的部分，都向後搜尋/檢查到章節末。
 # check_sections(): 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。
 # for_each_row(): 將可能修改了他人文字的編輯寫進記錄頁面 [[User:cewbot/Signature check]]。
 # for_each_row(): 為沒有署名的編輯添加簽名標記。

 一般說來在討論頁留言的用途有:
 在條目的討論頁首段添加上維基專題、條目里程碑、維護、評級模板。
 TODO: 當一次性大量加入連續的文字時，僅僅當做一次編輯。例如貼上文件備查。 [[Special:Diff/45239349]]
 用戶在自己的討論頁首段添加上宣告或者維護模板。
 其他一般討論，應該加上署名。

 @see
 https://commons.wikimedia.org/wiki/Commons:Bots/Requests/SignBot
 https://zh.wikipedia.org/wiki/User:Crystal-bot

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
// 本工具將產生記錄頁面 [[User:cewbot/Signature check]]。
check_log_page = 'User:' + user_name + '/Signature check';

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// 只處理此一頁面。
var test_the_page_only = "",
// 回溯這麼多天。
days_back_to = 70,
// 用戶討論頁提示：如果進行了3次未簽名的編輯，通知使用者記得簽名。
unsigned_notification = 3,
// 除了在編輯首段的維基專題、條目里程碑、維護、評級模板之外，每個段落至少要有一個簽名。
// 因為有些時候可能是把正文中的文字搬移到討論頁備存，因此預設並不開啟。 e.g., [[Special:Diff/45239349]]
sign_each_section = false,
// 另可以破折號代替橫線。
more_separator = '...\n' + '⸻'.repeat(20) + '\n...',
// 只有ASCII符號。
PATTERN_symbol_only = /^[\t\n -@\[-`{-~]*$/;

// ----------------------------------------------------------------------------

// unsigned_user_hash[user][page title] = unsigned count
var unsigned_user_hash = CeL.null_Object(),
// 非內容的元素。例如章節標題不能算成內文，我們也不會在章節標題之後馬上就簽名；因此處理的時候，去掉最末尾的章節標題。
noncontent_type = {
	category : true,
	section_title : true
},
// 若是在首章節遇到這一些元素，就跳過、不算是正式內容。
first_section_skip_type = {
	category : true,
	transclusion : true
},
//
with_diff = {
	LCS : true,
	// line : true,
	line : false,
	index : 2,
	with_list : true
};

function show_page(row) {
	CeL.log('* [[User:' + row.user + ']] 編輯了 [[Special:Diff/' + row.revid + '|'
			+ row.title + ']]');
}

// 從頁面資訊做初步的篩選。
function filter_row(row) {
	if (CeL.is_debug(2)) {
		show_page(row);
	}

	var passed =
	// 為了某些編輯不加 bot flag 的 bot。
	!/bot/i.test(row.user)
	// 篩選頁面標題。
	// 跳過封存/存檔頁面。
	&& !/\/(?:archive|舊?存檔|旧?存档|檔案|档案)/i.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)
	// 必須是白名單頁面，
	&& (row.title.startsWith('Wikipedia:互助客栈/')
	// ...或者討論頁面。
	|| CeL.wiki.is_talk_namespace(row.ns)
	// for test
	|| test_the_page_only && row.title === test_the_page_only)
	// 篩選編輯摘要。排除還原的編輯。
	// "!nosign!": 已經參考、納入了一部分 [[commons:User:SignBot|]] 的做法。
	&& !/还原|還原|revert|取消.*(编辑|編輯)|更改回|!nosign!/i.test(row.comment);

	return passed;
}

if (test_the_page_only) {
	CeL.info('處理單一頁面 ' + CeL.wiki.title_link_of(test_the_page_only)
			+ ': 先取得頁面資料。');
	wiki.page(test_the_page_only, function(page_data) {
		var revision = CeL.wiki.content_of.revision(page_data);
		page_data.user = revision.user;
		page_data.timestamp = revision.timestamp;
		page_data.revid = revision.revid;
		// The edit comment / summary.
		page_data.comment = revision.comment;

		// 解析頁面結構。
		CeL.wiki.parser(page_data).parse();
		page_data.from_parsed = CeL.wiki.parser(
				CeL.wiki.content_of(page_data, -1)).parse();
		page_data.diff = CeL.LCS(page_data.from_parsed.map(function(token) {
			return token.toString();
		}), page_data.parsed.map(function(token) {
			return token.toString();
		}), Object.assign({
			diff : true
		}, with_diff));

		// 處理單一頁面的時候開啟偵錯模式。
		CeL.set_debug(2);
		if (CeL.is_debug(2))
			console.log(page_data);
		for_each_row(page_data);
	}, {
		rvprop : 'ids|timestamp|content|user|comment',
		rvlimit : 2
	});

} else {
	CeL.info('開始監視/scan'
	//
	+ (days_back_to > 0 ? ' ' + days_back_to + '天前起' : '最近') + '更改的頁面。');
	wiki.listen(for_each_row, {
		start : days_back_to,
		filter : filter_row,
		with_diff : with_diff,
		parameters : {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right
			// to request the patrolled flag.
			rcshow : '!bot',
			rcprop : 'title|ids|sizes|flags|user'
		},
		interval : 500
	});
}

// ---------------------------------------------------------

function for_each_row(row) {
	delete row.row;
	// CeL.set_debug(2);
	if (false) {
		console.log(row);
		return;
		console.log(row.diff);
	}
	CeL.debug('做初步的篩選: 以討論頁面為主。', 5);
	if (!row.diff
	// 跳過封存/存檔頁面。 e.g., [[Wikipedia talk:首页/header/preload]]
	|| /\/(?:archive|存檔|存档|檔案|档案|header|preload)/i.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)
	// 必須是白名單頁面
	|| row.title.startsWith('Wikipedia:互助客栈')
	//
	&& !row.title.startsWith('Wikipedia:互助客栈/')
	// 篩選頁面內容。
	|| !row.revisions || !row.revisions[0]
	// 跳過重定向頁。
	|| CeL.wiki.parse.redirect(row.revisions[0]['*'])
	// [[WP:SIGN]]
	|| CeL.wiki.edit.denied(row, user_name, 'SIGN')) {
		return;
	}
	if (CeL.is_debug(4)) {
		row.revisions.forEach(function(revision) {
			delete revision['*'];
		});
		delete row.diff;
		console.log(row);
	}

	if (CeL.is_debug(2)) {
		CeL.info('='.repeat(75));
		show_page(row);
		console.log(row);
	}

	// 比較頁面修訂差異。
	// TODO: 正常情況下 token 都是完整的；但是也要應對一些編輯錯誤或者故意編輯錯誤。
	// row.parsed, row.diff.to 的每一元素都是完整的 token；並且兩者的 index 相對應。
	// @see add_listener() in CeL.application.net.wiki
	// row.diff.to[index] === row.parsed[index].toString();
	var to = row.diff.to, to_length = to.length, all_lines = [],
	/** {Integer}第二個段落在row.parsed中的 index。 */
	second_section_index = row.parsed.length;

	row.parsed.some(function(token, index) {
		if (token.type === 'section_title') {
			second_section_index = index;
			return true;
		}
	});
	if (CeL.is_debug(2)) {
		CeL.info('second_section_index: ' + second_section_index + '/'
				+ row.diff.to.length);
	}

	// -----------------------------------------------------

	var check_log = [], added_signs = 0, last_processed_index, queued_start, is_unsigned_user;

	// 對於頁面每個修改的部分，比較頁面修訂差異。
	// 有些可能只是搬移，只要任何一行有簽名即可。
	row.diff.forEach(check_diff_pair);

	function check_diff_pair(diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(75) + '\ncheck_diff_pair:');
			console.log(diff_pair);
		}

		// [ to_index_start, to_index_end ] = diff_pair.index[1]
		var to_index_start = diff_pair.index[1];
		if (!to_index_start) {
			CeL.debug('跳過: 這一段編輯刪除了文字 / deleted。', 2);
			return;
		}
		var to_index_end = to_index_start[1];
		to_index_start = to_index_start[0];

		if (to_index_end < last_processed_index) {
			CeL.debug('跳過: 這一段已經處理過。', 2);
			return;
		}

		for (var to_index = to_index_start; to_index <= to_index_end; to_index++) {
			var token = row.parsed[to_index];
			if (to_index_start === to_index) {
				if (typeof token === 'string' && !token.trim()) {
					CeL.debug('跳過一開始的空白。', 4);
					to_index_start = to_index + 1;
				}

			} else if (!sign_each_section) {
				continue;

			} else if (token.type === 'section_title') {
				// assert: to_index > to_index_start
				CeL.debug('這一小段編輯跨越了不同的段落。但是我們會檢查每個個別的段落，每個段落至少要有一個簽名。', 4);
				check_sections(to_index_start, to_index - 1, to_index,
						diff_pair, diff_index);
				// reset: 跳過之前的段落。但是之後的還是得繼續檢查。
				to_index_start = to_index;
			}
		}

		if (to_index_start > to_index_end) {
			last_processed_index = to_index_end;
			return;
		}

		var next_section_index = to_index_end;
		CeL.debug('對於頁面每個修改的部分，都向後搜尋/檢查到章節末。', 4);
		while (++next_section_index < row.parsed.length) {
			var token = row.parsed[next_section_index];
			if (token.type === 'section_title') {
				break;
			}
		}

		if (!sign_each_section
				&& next_section_index === (row.diff[diff_index + 1]
				// 假如兩段之間沒有段落或者只有空白字元，那將會把他們合併在一起處理。
				&& row.diff[diff_index + 1].index[1] && row.diff[diff_index + 1].index[1][0])) {
			if (!(queued_start >= 0))
				queued_start = to_index_start;
			CeL.debug('合併段落 ' + [ diff_index, diff_index + 1 ]
					+ '，start index: ' + queued_start + '。', 2);
			return;
		}

		if (queued_start >= 0) {
			CeL.debug('之前合併過段落，start index: ' + to_index_start + '→'
					+ queued_start, 2);
			to_index_start = queued_start;
			queued_start = undefined;
		}

		// console.log([ to_index_end, next_section_index, row.parsed.length ]);

		check_sections(to_index_start, to_index_end, next_section_index,
				diff_pair, diff_index);
		last_processed_index = next_section_index;
	}

	// 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。
	function check_sections(to_diff_start_index, to_diff_end_index,
			next_section_index, diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(60) + '\ncheck_sections: to of '
					+ CeL.wiki.title_link_of(row) + ':');
			console.log(row.diff.to.slice(to_diff_start_index,
					to_diff_end_index + 1));
			CeL.info('-'.repeat(4) + ' ↑ diff part ↓ list to next section');
			console.log(row.diff.to.slice(to_diff_end_index + 1,
					next_section_index));
		}

		while (to_diff_end_index >= to_diff_start_index) {
			var token = row.parsed[to_diff_end_index];
			if (typeof token === 'string') {
				if (token.trim())
					break;
				--to_diff_end_index;
				// continue; 去掉最末尾的空白字元。
			} else if (noncontent_type[token.type]) {
				// e.g., [[Special:Diff/45536065|Talk:青色]]
				CeL.debug('這一次編輯，在最後加上了非內容的元素 ' + token + '。將會把簽名加在這之前。', 2);
				--to_diff_end_index;
				// continue; 去掉最末尾的非內容的元素。
			} else {
				break;
			}
		}

		if (to_diff_start_index > to_diff_end_index) {
			CeL.debug('跳過: 去掉最末尾的非內容的元素之後，就沒有東西了。', 2);
			return;
		}

		// --------------------------------------

		var first_section_text = '';
		function first_section_text_may_skip() {
			var token_list = [];
			// 取得最頂端階層、模板之外的wikitext文字。
			for (var index = to_diff_start_index, previous_token = row.parsed[index - 1]; index <= to_diff_end_index; index++) {
				var token = row.parsed[index];
				// 完全忽略註解。
				if (token.type === 'comment') {
					continue;
				}
				first_section_text += token;
				if (first_section_skip_type[token.type]
				//
				&& (index === 0 || previous_token
				//
				&& (typeof previous_token === 'string'
				// assert: 維護、評級模板一般會從新的一行開始。
				? previous_token.endsWith('\n') :
				// 當多個模板擠在同一行中時，算一個模板即可。
				first_section_skip_type[previous_token.type]))) {
					previous_token = token;
					continue;
				}
				// console.log([ previous_token, index, token ]);
				token_list.push(token);
				previous_token = token;
			}
			if (false) {
				// for e.g., "{{t1}}{{t2}}" in the same line.
				token_list = token_list.map(function(token) {
					token = token.toString()
					// 採用這個方法會更好。
					.replace_till_stable(/{{[^{}]+?}}/g, '');
					return token;
				});
			}
			token_list = token_list.join('').trim();
			CeL.debug('篩選過的首段文字剩下 ' + JSON.stringify(token_list), 2);
			// 首段文字只有ASCII符號。
			return PATTERN_symbol_only.test(token_list);
		}

		var check_log_queue = [];
		if (to_diff_end_index < second_section_index) {
			if (row.ns === CeL.wiki.namespace('user_talk')) {
				CeL.debug('測試是不是用戶在自己的討論頁首段添加上宣告或者維護模板。', 2);
				// row.title.startsWith(row.user)
				if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
					CeL.debug('跳過使用者編輯屬於自己的頁面。', 2);
					if (first_section_text_may_skip()) {
						// Skip
						return;
					}
					// 對於非宣告的情況，即使是在自己的討論頁中留言，也應該要簽名。
				}
				if (first_section_text_may_skip()) {
					if (/^{{(?:Talk ?archive|讨论页存档|存档页|存檔頁)}}$/i
							.test(first_section_text.trim())) {
						CeL.debug('跳過: 只幫忙加入存檔模板。', 2, 'check_sections');
						return;
					}
					var message = '這一段編輯只加了模板或者沒有具體意義的文字。但是為了抓出修改別人留言的編輯，因此不在先期篩選中將之去除。';
					CeL.debug(message, 2, 'check_sections');
					check_log_queue.push(message);
				}

			} else if (CeL.wiki.is_talk_namespace(row.ns)) {
				CeL.debug('測試是不是在條目的討論頁首段添加上維基專題、條目里程碑、維護、評級模板。', 2);
				if (first_section_text_may_skip()) {
					// Skip: 忽略僅增加模板的情況。去掉編輯頁首模板的情況。
					// e.g., 在首段落增加 {{地鐵專題}} {{臺灣專題|class=Cat|importance=NA}}
					// {{香港專題|class=stub}} {{Maintained|}} {{translated page|}}
					// {{ArticleHistory|}}
					CeL.debug('跳過修改模板中參數的情況。', 1, 'check_sections');
					return;
				}
			}
			// 可能會漏判。
		}

		// --------------------------------------

		CeL.debug('當作其他一般討論，應該加上署名。', 2);

		// 從修改的地方開始，到第一個出現簽名的第一層token為止的文字。
		var section_wikitext = row.diff.to.slice(to_diff_start_index,
				to_diff_end_index + 1);

		for (var index = to_diff_end_index + 1; index < next_section_index; index++) {
			var token = row.diff.to[index];
			section_wikitext.push(token);
			// TODO: 應該使用 function for_each_token()
			if (CeL.wiki.parse.user(token)) {
				break;
			}
		}

		section_wikitext = section_wikitext.join('');

		if (CeL.wiki.content_of.revision(row).length > 1
				&& CeL.wiki.content_of(row, -1).includes(
						section_wikitext.trim())) {
			// 可能需要人工手動檢查。可能是 diff 操作仍有可改善之處。寧可跳過漏報，不可錯殺。
			// e.g., [[Special:Diff/45311637]]
			check_log.push([ '此筆編輯之前就已經有這一段文字', section_wikitext ]);
			return;
		}

		if (PATTERN_symbol_only.test(section_wikitext)) {
			// @see [[Special:Diff/45254729]]
			check_log.push([ '此筆編輯僅僅添加了符號', section_wikitext ]);
			return;
		}

		// https://www.mediawiki.org/wiki/Transclusion
		if (/<\/?(?:noinclude|onlyinclude|includeonly)[ >]/i
				.test(section_wikitext)) {
			// 雖然這些嵌入包含宣告應該使用在template:命名空間，但是既然加了，還是得處理。
			check_log
					.push([
							'這段修改中包含有[[WP:TRANS|嵌入包含]]宣告如<code>&lt;noinclude></code>，因此跳過不處理',
							section_wikitext ]);
			return;
		}

		// --------------------------------------

		/** {Natural}下一個段落前最後一個不同之index。 */
		var last_diff_index_before_next_section = to_diff_end_index,
		// assert:to_next_diff_start_index >= 1
		to_next_diff_start_index = to_diff_end_index + 1;
		// 找出下一個段落前最後一個不同之處。
		for (var index = diff_index; ++index < row.diff.length;) {
			var to_diff_index = row.diff[index].index[1];
			if (!to_diff_index) {
				// 這一段變更只刪除了文字。
				continue;
			}
			to_next_diff_start_index = to_diff_index[1]
					|| to_next_diff_start_index;
			if (to_diff_index[1] >= next_section_index) {
				if (to_diff_index[0] < next_section_index) {
					// 下一段變更開始於段落標題之前。把簽名加在段落標題最前之前。
					last_diff_index_before_next_section = next_section_index - 1;
				}
				break;
			}
			if (to_diff_index[1] < next_section_index) {
				last_diff_index_before_next_section = to_diff_index[1];
				// 繼續檢查下一段變更。
			}
		}

		// --------------------------------------

		// 提取出所有簽名。
		// TODO: 應該使用 function for_each_token()
		var user_list = CeL.wiki.parse.user.all(section_wikitext);
		// console.log([ 'row.user:', row.user, section_wikitext ]);

		// [[Wikipedia:签名]]: 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
		if (user_list.length > 0) {
			if (user_list.includes(row.user)) {
				// has user link
				CeL.debug('直接跳過使用者' + row.user
						+ '編輯屬於自己的頁面。但是這在編輯同一段落中其他人的發言時可能會漏判。', 2);
				return;
			}

			var from_user_list = diff_pair[0].join('');
			if (to_diff_end_index < last_diff_index_before_next_section) {
				// 加上到下一個段落之前相同的部分。但是請注意，這可能造成漏報。
				from_user_list += row.diff.to.slice(to_next_diff_start_index,
						last_diff_index_before_next_section).join('');
			}
			from_user_list = CeL.wiki.parse.user.all(from_user_list);
			user_list = user_list.filter(function(user) {
				// 跳過對機器人的編輯做出的修訂。
				return !/bot/i.test(user)
				// 只有在原先文字中就存在的使用者，才可能是被修改到的。要不然就是本次編輯添加的，例如搬移選舉結果的情況。
				&& from_user_list.includes(user);
			});
			// console.log([ from_user_list, user_list ]);
			if (user_list.length > 0) {
				check_log.push([
						row.user
						// e.g., "{{Ping|Name}}注意[[User:Name]]的此一編輯~~~~"
						+ ' 可能編輯了 ' + user_list.join(', ')
						// e.g., 您創建的條目~~可能侵犯版權
						+ ' 署名的文字（也可能是用戶' + row.user
								+ '代簽名、幫忙修正錯誤格式、特意提及、搬移條目討論，或是還原/撤銷編輯）',
						section_wikitext ]);
			} else {
				CeL.debug('在舊版的文字中並沒有發現簽名。或許是因為整段搬移貼上？', 2);
			}
			CeL.debug('終究是已經署名過了，因此不需要再處理。', 2);
			return;

		} else if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
			CeL.debug('在編輯自己的用戶頁，並且沒有發現任何簽名的情況下就跳過。', 2);
			return;

		} else if (row.user.length > 4
		// e.g., [[Special:Diff/45178923]]
		&& (new RegExp(CeL.to_RegExp_pattern(row.user)
		//
		.replace(/[ _]/g, '[ _]'), 'i')).test(section_wikitext)) {
			// 但是若僅僅在文字中提及時，可能會被漏掉，因此加個警告做紀錄。
			check_log
					.push([
							row.user
									+ '似乎未以連結的形式加上簽名。例如只寫了用戶名或日期，但是沒有加連結的情況。也有可能把 <code>~~<nowiki />~~</code> 輸入成 <code>~~<nowiki />~~~</code> 了',
							section_wikitext ]);
			// TODO: 您好，可能需要麻煩改變一下您的留言簽名格式 {{subst:Uw-signlink}} --~~~~
			return;
		}

		// --------------------------------------
		// 該簽名而未簽名。未簽補上簽名。

		added_signs++;

		var last_token = row.diff.to[last_diff_index_before_next_section],
		// 匿名使用者/未註冊用戶 [[WP:IP]]
		is_IP_user =
		// for IPv4
		/^\d{1,3}(?:\.\d{1,3}){3}$/.test(row.user)
		// for IPv6
		|| /[\da-f]{1,4}(?::[\da-f]{1,4}){7}/i.test(row.user);

		if (check_log_queue.length > 0) {
			check_log.append(check_log_queue);
		}
		check_log.push([ (/2\d{3}年\d{1,2}月{1,2}日/.test(last_token)
		//
		? '編輯者或許已經加上日期與簽名，但是並不明確。仍然' : '') + '需要在最後補上'
		//
		+ (is_IP_user ? 'IP用戶' : '用戶') + ' ' + row.user + ' 的簽名',
		// 一整段的文字。
		row.diff.to.slice(to_diff_start_index,
		//
		last_diff_index_before_next_section + 1).join('') ]);

		if (!row.parsed_time) {
			// 補簽的時間戳能不能跟標準簽名格式一樣，讓時間轉換的小工具起效用。
			// should be the same as "~~~~~"
			row.parsed_time = (new Date(row.timestamp)).format({
				format : '%Y年%m月%d日 (%w) %2H:%2M (UTC)',
				zone : 0,
				locale : 'cmn-Hant-TW'
			}).replace('星期', '');
		}

		// 添加簽名。
		is_unsigned_user = true;

		row.diff.to[last_diff_index_before_next_section] = last_token
		// {{subst:unsigned|用戶名或IP|時間日期}}
		.replace(/([\s\n]*)$/, '{{subst:unsigned|' + row.user + '|'
				+ row.parsed_time + (is_IP_user ? '|IP=1' : '') + '}}$1');

		CeL.info('需要在最後補簽名的編輯: ' + CeL.wiki.title_link_of(row));
		console.log(row.diff.to.slice(to_diff_start_index,
				last_diff_index_before_next_section + 1).join(''));
		show_page(row);
		CeL.info('-'.repeat(75));
	}

	// -----------------------------------------------------
	// 處理有需要注意的頁面。

	if (check_log.length > 0) {
		// TODO: 跳過搬移選舉結果
		if (CeL.is_debug()) {
			CeL.info(CeL.wiki.title_link_of(row) + ': 將可能修改了他人文字的編輯寫進記錄頁面 '
					+ CeL.wiki.title_link_of(check_log_page));
			CeL.info('-'.repeat(75));
		}
		check_log = check_log.map(function(log) {
			if (!Array.isArray(log)) {
				return log;
			}
			log[0] += ' (' + log[1].length + ' 字):\n<pre><nowiki>';
			var more = '';
			if (log[1].length > 80 * 2 + more_separator.length + 20) {
				more = more_separator + log[1].slice(-80);
				log[1] = log[1].slice(0, 80);
			}
			// escape
			return log[0] + log[1].replace(/</g, '&lt;') + more
					+ '</nowiki></pre>';
		});
		check_log.unshift((CeL.wiki.content_of.revision(row).length < 2
		// 新頁面
		? '; [[Special:Permalink/' + row.revid + '|' + row.title + ']]'
		// show diff link
		: '; [[Special:Diff/' + row.revid + '|' + row.title + ']]')
		//
		+ ': '
		// add [[Help:編輯摘要]]。
		+ (row.comment ? row.comment + ' ' : '')
		// add timestamp
		+ '--' + (row.parsed_time || row.timestamp)
		//
		);
		wiki.page(check_log_page).edit(check_log.join('\n* '), {
			section : 'new',
			sectiontitle : row.title,
			nocreate : 1,
			bot : 1,
			summary : 'Signature check report of '
			//
			+ CeL.wiki.title_link_of(row.title)
			//
			+ ', [[Special:Diff/' + row.revid + ']]'
		});
	}

	if (!added_signs) {
		return;
	}

	return;

	CeL.debug('為沒有署名的編輯添加簽名標記。', 2);
	// 若是row並非最新版，則會放棄編輯。
	wiki.page(row).edit(row.diff.to.join(''), {
		nocreate : 1,
		summary :
		//
		'為[[Special:Diff/' + row.revid + '|' + row.user + '的編輯]]補簽名。'
	});

	if (!is_unsigned_user) {
		return;
	}

	CeL.debug('用戶討論頁提示：如果未簽名編輯了 ' + unsigned_notification + ' 次，通知使用者記得簽名。', 2);
	var unsigned_pages = unsigned_user_hash[row.user];
	if (!unsigned_pages) {
		unsigned_pages = unsigned_user_hash[row.user] = CeL.null_Object();
	}
	unsigned_pages[row.title] = (unsigned_pages[row.title] | 0) + 1;
	if (unsigned_pages[row.title] > unsigned_notification) {
		unsigned_pages = Object.keys(unsigned_pages).map(function(title) {
			return CeL.wiki.title_link_of(title);
		}).join(', ');
		wiki.page('User:' + row.user).edit('{{subst:Uw-tilde||可能需要簽名的頁面例如 '
		// [[MediaWiki:Talkpagetext/zh]]
		+ unsigned_pages + '。謝謝您的參與。 --~~~~}}', {
			section : 'new',
			sectiontitle : '請記得在留言時署名',
			summary : '提醒使用者記得簽名，例如在文中所列的 ' + unsigned_pages.length + ' 個頁面'
		});
		// reset unsigned count of user
		delete unsigned_user_hash[row.user];
	}

}
