const os = require('os');
const child_process = require('child_process');
const toString = Object.prototype.toString;
const is = (obj, type)=>{return toString.call(obj) == '[object '+type+']'}

global.dpc = (delay, fn)=>{
	if(typeof delay == 'function')
		return setTimeout(delay, fn||0);

	return setTimeout(fn, delay||0);
}

class Utils{

	isArray(obj){return Array.isArray(obj);/*return is(obj, 'Array')*/}
	isObject(obj){return is(obj, 'Object')}
	isString(obj){return is(obj, 'String')}
	isNumber(obj){return is(obj, 'Number')}
	isUndefined(obj){return is(obj, 'Undefined')}

	get platform(){
		let platform = os.platform();
		platform = ({ 'win32' : 'windows' }[platform]) || platform;
		let arch = os.arch();
		return `${platform}-${arch}`;
	}

	spawn(file, args, options = { }){
		return new Promise((resolve, reject) => {

			const { env } = process;

			let proc = child_process.spawn(file,args,Object.assign({ env }, options));
			let done = false;

			const filter = typeof options.stdout == 'function';

			proc.stdout?.on?.('data', (data) => {
				if(filter)
					data = options.stdout(data);
				if(data)
					process.stdout.write(data);
			});

			proc.stderr?.on?.('data', (data) => {
				if(filter)
					data = options.stdout(data);
				if(data)
					process.stderr.write(data);
			});

			proc.on('close', (code) => {
				if(!done) {
					resolve(code);
					done = true;
				}
			})

			proc.on('error', (err) => {
				if(!done) {
					done = true;
					reject(err);
				}
			})
		})
	}

	match(text, regexp){
	    return ((text && text.match(regexp) || {}).groups || {});
	}

	args(args){
	    args = args || process.argv.slice(2);

	    let argsRegex = null;
	    try {
	        argsRegex = new RegExp('^--(?<prop>[\\w-]+)(=(?<value>.+))?$');
	    } catch(ex) { /*console.log(ex);*/ }

	    let o = { }

	    if(!argsRegex) {

	        args.forEach((arg)=>{
	            arg = arg.split('=');
	            let k = arg.shift();
	            let v = arg.shift();
	            k = k.replace(/^--/,'');
	            if(v !== undefined) o[k] = v; else o[k] = true;
	        });

	        return o;
	    }


	    args.map((arg) => {
	        const { prop, value } = utils.match(arg,argsRegex);

	        if(value == undefined)
	            o[prop] = true;
	        else
	        if(o[prop]) {
	            if(Array.isArray(o[prop]))
	                o[prop].push(value);
	            else
	                o[prop] = [o[prop], value];
	        }
	        else {
	            o[prop] = value;
	        }
	    })
	    return o;
	}
}

if(!Number.prototype.toFileSize) {
	Object.defineProperty(Number.prototype, 'toFileSize', {
		value: function(a, asNumber){
			let b,c,d;
			let r = (
				a=a?[1e3,'k','B']:[1024,'K','iB'],
				b=Math,
				c=b.log,
				d=c(this)/c(a[0])|0,this/b.pow(a[0],d)
			).toFixed(2)

			if(!asNumber)
				r += ' '+(d?(a[1]+'MGTPEZY')[--d]+a[2]:'Bytes');
			return r;
		},
		writable:false,
		enumerable:false
	});
}

if(!Number.prototype.toCS) {
	Object.defineProperty(Number.prototype, 'toCS', {
	   value: function(p, tz){
			let precision = p || 0;
			let f = (this).toFixed(precision).split('.');
			f[0] = f[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			let t = f.join('.');
			if(!tz || !~t.indexOf('.'))
				return t;
			while(t.length > 2 && t[t.length-1] == 0 && t[t.length-2] != '.')
				t = t.substring(0, t.length-1);
			return t;
		},
		writable:false,
		enumerable:false
	});
}

const utils = new Utils();
utils.isNw = typeof nw != 'undefined' && typeof nw.App != 'undefined';
utils.is = is;
utils.toString = toString;

module.exports = utils;
