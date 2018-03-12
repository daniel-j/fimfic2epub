/* eslint-disable */
/*Copyright (c) 2017 Dominik Homberger

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

https://webpjs.appspot.com
WebPRiffParser dominikhlbg@gmail.com
*/

function memcmp(data, data_off, str, size) {
	for(var i=0;i<size;i++)
		if(data[data_off+i]!=str.charCodeAt(i))
			return true;
	return false;
}

function GetTag(data, data_off) {
	var str='';
	for(var i=0;i<4;i++)
		str +=String.fromCharCode(data[data_off++]);
	return str;
}

function GetLE16(data,data_off) {
  return (data[data_off+0] << 0) | (data[data_off+1] << 8);
}

function GetLE24(data,data_off) {
  return ((data[data_off+0] << 0) | (data[data_off+1] << 8) | (data[data_off+2] << 16))>>>0;
}

function GetLE32(data,data_off) {
  return ((data[data_off+0] << 0) | (data[data_off+1] << 8) | (data[data_off+2] << 16) | (data[data_off+3] << 24))>>>0;
}

function WebPRiffParser(src,src_off) {

var imagearray={};var i=0;var alpha_chunk=false;var alpha_size=0; var alpha_offset=0;imagearray['frames']=[];
	if(memcmp(src,src_off,'RIFF',4)) return;
	src_off +=4;
	var riff_size = GetLE32(src, src_off)+8;
	src_off +=8;
	
	while(src_off<src.length) {
		var fourcc=GetTag(src,src_off);
		src_off +=4;
		
		var payload_size = GetLE32(src, src_off);
		src_off +=4;
		var payload_size_padded = payload_size + (payload_size & 1);
		
		switch(fourcc) {
			case "VP8 ":
			case "VP8L":
				if(typeof imagearray['frames'][i]==='undefined') imagearray['frames'][i]={};var obj=imagearray['frames'][i];
				var height=[0];
				var width=[0];
				obj['src_off']=alpha_chunk?alpha_offset:src_off-8;
				obj['src_size']=alpha_size+payload_size+8;
				//var rgba = webpdecoder.WebPDecodeRGBA(src,(alpha_chunk?alpha_offset:src_off-8),alpha_size+payload_size+8,width,height);
				//imagearray[i]={'rgba':rgba,'width':width[0],'height':height[0]};
				i++;
				if(alpha_chunk) {
					alpha_chunk=false;
					alpha_size=0;
					alpha_offset=0;
				}
				break;
			case "VP8X":
				var obj=imagearray['header']={};
				var feature_flags=obj['feature_flags']=src[src_off];
				var src_off_ =src_off+4;
				var canvas_width=obj['canvas_width']= 1 + GetLE24(src,src_off_);
				src_off_ +=3;
				var canvas_height=obj['canvas_height']= 1 + GetLE24(src,src_off_);
				src_off_ +=3;
				break;
			case "ALPH":
				alpha_chunk=true;
				alpha_size=payload_size_padded+8;
				alpha_offset=src_off-8;
				break;
			
			case "ANIM":
				var obj=imagearray['header'];
				var bgcolor=obj['bgcolor']=GetLE32(src,src_off);
				src_off_ =src_off+4;
				
				var loop_count=obj['loop_count']=GetLE16(src,src_off_);
				src_off_ +=2;
				break;
			case "ANMF":
				var offset_x=0, offset_y=0, width=0, height=0, duration=0, blend=0, dispose=0, temp=0;
				var obj=imagearray['frames'][i]={};
				obj['offset_x']=offset_x = 2 * GetLE24(src,src_off); src_off +=3;
				obj['offset_y']=offset_y = 2 * GetLE24(src,src_off); src_off +=3;
				obj['width']=width = 1 + GetLE24(src,src_off); src_off +=3;
				obj['height']=height = 1 + GetLE24(src,src_off); src_off +=3;
				obj['duration']=duration = GetLE24(src,src_off); src_off +=3;
				temp = src[src_off++];
				obj['dispose']=dispose = temp & 1;
				obj['blend']=blend = (temp >> 1) & 1;
				break;
			default:
		}
		if(fourcc!="ANMF")
		src_off+=payload_size_padded;
	}
	return imagearray;
}

module.exports['WebPRiffParser']=WebPRiffParser;
