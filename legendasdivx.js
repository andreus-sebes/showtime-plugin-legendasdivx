/*
 *  LegendasDivx subtitle plugin for Showtime
 *
 *  Copyright (C) 2013 andreus sebes
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function(plugin) {

	var main_url="http://www.legendasdivx.com/modules.php";
	var plugin_info = plugin.getDescriptor();
	var cookies='';
	var logged=false;

    var service = plugin.createService(plugin_info.title, plugin_info.id+":start", "other", false, plugin.path+plugin_info.icon);
    var settings = plugin.createSettings(plugin_info.title, plugin.path+plugin_info.icon, plugin_info.title+": "+plugin_info.synopsis);
	settings.createInfo("info", plugin.path+plugin_info.icon, plugin_info.synopsis+"\n\n"+plugin_info.description+"\n\nPlugin developed by "+plugin_info.author+"\n\nHomepage: "+plugin_info.homepage);
	settings.createDivider("User settings");
	settings.createString("username", "Username", "", function(v) { service.username = v; });
	settings.createString("userpassword", "Password", "", function(v) { service.userpassword = v; });
	settings.createDivider("Search settings");
	settings.createMultiOpt("forcelang", "Force language",  [['', 'Use showtime defaults (no force)', true], ['28', 'European Portuguese'], ['29', 'Brazilian Portuguese']], function(v) { service.forcelang = v; });
	settings.createDivider("Advanced settings");
	settings.createBool("debug", "Debug?", false, function(v) { service.debug = v; });
	function getCookie(response, id)
	{
		if (response.multiheaders['Set-Cookie'][id]) return response.multiheaders['Set-Cookie'][id].slice(0,response.multiheaders['Set-Cookie'][id].indexOf(';'));
		return 'cookie not found';
	}

	function trace(obj)
	{
		showtime.trace(obj.toString(), plugin_info.title);
	}

	function login()
	{
		trace('Attempting to login as '+service.username+'...');
		try
		{
			var argVar = {
				'op': 'login',
				'username': service.username,
				'user_password': service.userpassword,
				'mode': '',
				'f': '',
				't': '',
				'redirect': ''
			};
			var controls = {
				'noFollow': true,
				'debug': false,
				'headRequest': true
			};

			var login_result=showtime.httpPost(main_url+"?name=Your_Account", argVar, null, null, controls);
			cookies = getCookie(login_result,0);
			if (service.debug=='1') trace('Cookie: '+cookies);
			var matches = cookies.toString().match(/user=/);
			if (matches != null) logged=true;
			trace('- Logged?: '+logged.toString());
		}
		catch (err)
		{
			trace('Login error: '+err);
			if (service.debug=='1') showtime.message('Login error: '+err, true, false);
		}
	}

	function search(req, search_imdbid,search_title)
	{
		trace('Attempting to search subtitles...');
		// Get list of user preferred languages for subs
		var sub_lang ='por';
		var search_cat='28';
		if (service.forcelang!='')
		{
			search_cat=service.forcelang;
			if (search_cat=='28') sub_lang='por';
			else if (search_cat=='29') sub_lang='pob';
			if (service.debug=='1') trace('Force subtitle languages: '+sub_lang);
		}
		else
		{
			sub_lang = showtime.getSubtitleLanguages().join(',');
			if (sub_lang=='por') search_cat='28';
			else if (sub_lang=='pob') search_cat='29';
			if (service.debug=='1') trace('Showtime subtitle languages: '+sub_lang);
		}
		if (search_imdbid!='')
		{
			var search_uri=main_url+"?name=Downloads&d_op=search&orderby=dateD&file=jz&op=_jz00&imdbid="+search_imdbid+"&query=&form_cat="+search_cat;
			var search_type="imdbid";
		}
		else
		{
			var search_uri=main_url+"?name=Downloads&d_op=search&orderby=dateD&file=jz&op=_jz00&imdbid=&query="+search_title+"&form_cat="+search_cat;
			var search_type="fulltext";
		}
		if (service.debug=='1') trace('- Search URI: '+search_uri);
		try
		{
			var found=0;
			var search_result=showtime.httpGet(search_uri).toString();
			var pattern_title = /<b>([^<]+)<\/b> \(([0-9]+)\) \&nbsp\; \- \&nbsp\;/g;
			var pattern_author = /User\_Info\&username=(.+)'/g;
			var pattern_lid = /getit\&lid=([0-9]+)/g;
			var match_lid;
			var match_author;
			var match_title;
			//var head={
			//	'Host': 'www.legendasdivx.com',
			//	'Connection': 'keep-alive',
			//	'Cache-Control': 'no-cache',
			//	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			//  'Cookie': 'lang=portuguese; user=MjY0NDA6TWVzc2lhczo2Y2ZjYWYyZTFlZjU3ZTdiNTFlNWE5MDRiZDNjZDJjZToxMDo6MDowOjA6MDpzdWJTaWx2ZXI6NDA5Ng%3D%3D;
			//	'Pragma': 'no-cache',
			//	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.52 Safari/537.17',
			//	'Accept-Encoding': 'gzip,deflate,sdch',
			//	'Accept-Language': 'pt-PT,pt;q=0.8,en-US;q=0.6,en;q=0.4',
			//	'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
			//};

			var head={
				 'Cookie': 'lang=portuguese; '+cookies+';'
			};
			var controls = {
				'noFollow': false,
				'debug': true,
				'headRequest': true
			};
			while ((match_lid = pattern_lid.exec(search_result))!= null)
			{
				match_title = pattern_title.exec(search_result);
				match_author = pattern_author.exec(search_result);
				//var aaa_result=showtime.httpGet(main_url+"?name=Downloads&d_op=getit&lid="+match_lid[1].toString(),null,head,controls);
				req.addSubtitle(main_url+"?name=Downloads&d_op=getit&lid="+match_lid[1].toString(), match_title[1].toString()+' ('+match_title[2].toString()+') - '+match_author[1].toString()+'', sub_lang, "unknown", plugin_info.title+' ('+search_type+')', 0);
				found++;
			}
			trace('Found '+found.toString()+' subtitles');
		}
		catch (err)
		{
			trace('Search error: '+err);
			if (service.debug=='1') showtime.message('Search error: '+err, true, false);
		}
	}

	plugin.addSubtitleProvider(function(req)
	{

		// Build a query based on request from Showtime
		//req.filesize
		//req.opensubhash
		//req.filesize.toString()
		//req.imdb
		//req.title
		//req.season
		//req.episode

		// Loop so we can retry once (relogin) if something fails
		// This typically happens if the token times out
		if (service.username=='' && service.userpassword=='')
		{
			showtime.message(plugin_info.title+'\n\nHow need to go to plugin settings and configure you username and password.', true, false);
		}
		else
		{
			var search_imdbid='';
			var search_title='';

			if (req.imdb && req.imdb.indexOf('tt') == 0) search_imdbid = req.imdb.substring(2);
			else if (req.title) search_title = req.title.replace(/\./g," ");
			if (service.debug=='1') trace('IMDB Id: '+search_imdbid);
			if (service.debug=='1') trace('Title: '+search_title);

			if (logged == false) login();
			if (logged == true) search(req, search_imdbid,search_title);
		}
	});

})(this);
