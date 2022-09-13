export default JSON;
JSON.decycle = function decycle(object) {

	/* The JSON#decycle and #retrocycle functions are not mine, I just copied them from
	here https://github.com/douglascrockford/JSON-js/blob/master/cycle.js. 
	They change a circular object (for example `var a = {}; a.a = a;`) so that it can be converted into plain text
	which means that dynamic references to itself cannot be represented as simple characters (this would only 
	be possible if we had infinite bandwidth, because the resulting plaintext would be infinited in length, and we
	need to be able to send the maze's data to a remote server.). I tried writing my own versions of these two 
	funtions before I found the github above, and it got pretty close to working, but there was just an
	error, which at first seemed very minor and easy to fix, but I could not solve it for several hours on end.
	After I took a look at these functions the next day, I suddenly realised that what I was trying to do earler
	was completely the wrong approach:
	I tried to first convert the object into a linked list, then add all the prev. pointers, so that it became
	a linear "pathway" which could be traversed backwards and forwards. Then the algorithm would have changed all
	"seen" references to "go-outer-"+a_number, where a_number would be the amount of steps you need to take from 
	the current object/reference, in order to get to the reference needed. But I later realised that there was not 
	always a clear path from inside an object to some outside point. This is because objects are more like trees
	than linked lists, so in order to get to a specific location you may need to go inward and not just outward.
	This is why my approach was impossible to work, and this was the error which I initially called "minor" (because
	I didn't understand what was REALLY happening). PS: I was going to use the bencode approach and a hash table which
	would have had to be sent separately. Unnecessary complication of things happens very often...

	The decycle function will remove circular references, and the retrocycle func will restore them.
	*/

    var objects = new WeakMap();     // object to path mappings

    return (function derez(value, path) {

        var old_path;   // The path of an earlier occurance of value
        var nu;         // The new object or array
        if (
            typeof value === "object"
            && value !== null
            && !(value instanceof Boolean)
            && !(value instanceof Date)
            && !(value instanceof Number)
            && !(value instanceof RegExp)
            && !(value instanceof String)
        ) {

            old_path = objects.get(value);
            if (old_path !== undefined) {
                return {$ref: old_path};
            }


            objects.set(value, path);


            if (Array.isArray(value)) {
                nu = [];
                value.forEach(function (element, i) {
                    nu[i] = derez(element, path + "[" + i + "]");
                });
            } else {

                nu = {};
                Object.keys(value).forEach(function (name) {
                    nu[name] = derez(
                        value[name],
                        path + "[" + JSON.stringify(name) + "]"
                    );
                });
            }
            return nu;
        }
        return value;
    }(object, "$"));
};
JSON.retrocycle = function retrocycle($) {
    var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\(?:[\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

    (function rez(value) {

        if (value && typeof value === "object") {
            if (Array.isArray(value)) {
                value.forEach(function (element, i) {
                    if (typeof element === "object" && element !== null) {
                        var path = element.$ref;
                        if (typeof path === "string" && px.test(path)) {
                            value[i] = eval(path);
                        } else {
                            rez(element);
                        }
                    }
                });
            } else {
                Object.keys(value).forEach(function (name) {
                    var item = value[name];
                    if (typeof item === "object" && item !== null) {
                        var path = item.$ref;
                        if (typeof path === "string" && px.test(path)) {
                            value[name] = eval(path);
                        } else {
                            rez(item);
                        }
                    }
                });
            }
        }
    }($));
    return $;
};


export function loadStyles() {
	return new Promise(resolve => {
		const urls = ["style.css", "popup.css"];
		let loaded = 0;
		for(const url of urls) {
			const linkElmnt = document.createElement("link");
			linkElmnt.setAttribute("rel", "stylesheet");
			linkElmnt.setAttribute("type", "text/css");
			linkElmnt.setAttribute("href", "css/" + url);
			linkElmnt.addEventListener("load", () => {
				loaded++;
				if(loaded === urls.length) {
					// All are loaded
					resolve(true);
				}
			});
			document.head.appendChild(linkElmnt);
		}
	});
}



export const executeSQL = async (sqlStatement, options) => {
    const response = await jQuery.ajax({
        type: "POST",
        url: 'https://alpha-howl.com/database/php.php',
        dataType: 'json',
        data: {"argument": sqlStatement, action: options?.action||"SQL", dbName: options?.dbName}
    });
    // I made the https://alpha-howl.com/database/php.php server-side php script. Read the comment about CORS in the php script.
    // console.log("JSON.parse:");
    // Error here: Cannot JSON.parse this:
    // console.log(response.result);

    let resultObk = JSON.parse(response.result);
    return resultObk;
};


export const waitUntil = (conditionFunc => {
	return new Promise(ready => {
		let myInterval;
		function check() {
			if(conditionFunc()) {
				if(myInterval) {
					window.clearInterval(myInterval);
				}
				ready();
			};
		}

		check();
		myInterval = setInterval(check, 350);
	});
});



export function internetConnection() {
	return new Promise(resolve => {
		if(!navigator.onLine) {resolve(false);}
		try {
			fetch("https://picsum.photos/1") // For an actual rndm img: https://picsum.photos/200
				.then(() => {resolve(true);}, (er) => {console.log(er);resolve(false);})
				.catch(errr => {
					console.log(errr);
					resolve(false);
				});
		} catch(errr) {
			console.log(errr);
			resolve(false);
		}
	});
}



export function showCriticalMessage(options) {
	alert(options.title);
}



export function specialMerge(lista, listb) {
	let newList = new Array();
	while(lista.length && listb.length) { // This is a special merge func because it compares the frequencies of the words - not the words themselves. The word elmnts are in this format: [---word's value---, ---its freq---]. Also it sorts in reversing order as we need to give the most common words the smallest dictionary codes.
		const listToProcess = lista[0][1] > listb[0][1] ? lista : listb;
		newList.push(listToProcess[0]);
		listToProcess.shift();
	}
	const listWithRemainingElmnts = lista.length ? lista : listb;
	newList = newList.concat(listWithRemainingElmnts);
	return newList;
}
export function specialMergeSort(list) {
	list = list.map(x => [x]);
	let startPointer = 0;
	while(startPointer+1 < list.length) {
		const mergedList = specialMerge(list[startPointer], list[startPointer+1]);
		list.push(mergedList);
		startPointer += 2;
	}
	return list[list.length-1];
}


// This is huffman encoding
export const compress = (plainText) => {
	const frequencyCounter = {};
	const finalDictionary = {};
	
	/* Little explanation about the below loop:
		- plainText.matchAll(/\w{2,}/g) is a regular expression 
		- the \w represents a word. This is a group of character(s) which is separated by non-word characters - eg 
			spaces, full stops, commas, brackets etc etc
		- the {2,} means it only matches words of two characters of more - otherwise there is no point in compressing
			a single character.
		- the escaped characters, like \" or \$ just match that character.
		- the ? after some escaped characters like \:? means this character is optional and does not need to be matched, but will be anyway if it is found. This just helps increase the compression ratios a little.
		- the g flag means the matching process will find all matches (ie global)
		- the loop syntax is correct because String.proto.matchAll is a generator function (as far as im aware)
	*/


	plainText.match(/(\"?\$?(\w{2,})\\?\"?\:?)|\"(\d|\w)\"\:/g).forEach(currentLongWord => {
		frequencyCounter[currentLongWord] ??= 0; // Record the frequency of each word. We give the most common words the lowest dict-code.
		frequencyCounter[currentLongWord] += 1; // Another way would be to use two arrays and binary searching but i think objects are faster because they use hash tables if i remember correctly
	});

	let words = Object.entries(frequencyCounter);
	// Now sort words by using freqs[n] as the data

	const orderedWords = specialMergeSort(words);

	//console.log("Now give all of the matched words codes, giving the shortest code to the most common word. Save this in finalDictionary, which will be outputted at the end, along with compressedText.");
	//console.log("Now copy out the not-matched characters - ie any characters which are not words, as well as words which have a length lower than 2. But for each word which is matched write its code instead of the actual word.");

	let currentWordCode = 0;
	orderedWords.forEach(wordAndFreq => {
		finalDictionary[wordAndFreq[0]] = currentWordCode.toString(16);
		currentWordCode++;
	});

	// Simply change all occurences of words to their dictionary-equivalent
	const compressedText = plainText.replaceAll(/(\"?\$?(\w{2,})\\?\"?\:?)|\"(\d|\w)\"\:/g, (match) => {
		return "^"+finalDictionary[match]+"^";
	});
	



	/*Important note about this function: 
		I tried to make it faster by placing all dictionary-creating logic inside the 
		plainText.replaceAll(..regexp.., ..func..);
		callback func (labelled "..func.."). This means that the regular expression would only have to be matched once.
		But in JS, objects as well as regExps are so quick, that this was barely an improvement, and so I 
		chose to comprimise the few saved milliseconds (around 3-10 on average) in favour of better 
		code-readability, and hence easier mantanance. Moreover this function is not really slow anyway.
	*/

	return [compressedText, finalDictionary];
	// With random maze data, compression ratio as around 2.2 (makes it 2.2 times shorter);
};
export const decompress = (compressedText, dictionary) => {
	/* Explanation of regex (?<=\^)[0-9a-fA-F]+(?=\^):
		- the middle bit [0-9a-fA-F]+ matches any hex number. Eg 435A
		- the first bit (?<=\^) is a positive lookbehind. So it only matches this
		hex number if there is a ^ before it. Otherwise it would match any number. We need it
		to just match the dict-codes. They are marked with ^s.
		- the last bit is like the first bit, but it's a lookahead.
		- So, summary: it matches ^...hex-number...^, but returns only ...hex-number..., 
		leaving out the two ^s.
	*/

	// First flip the dictionary from word:code to code:word
	let dictCopy = Object.assign({}, dictionary);
	Object.keys(dictCopy).forEach(key => {
		dictionary[dictionary[key]] = key;
	});

	const uncompressedText = compressedText.replaceAll(/\^[0-9a-fA-F]+\^/g, (match) => {
		match = match.substr(1, match.length-2);
		return dictionary[match];
	});

	return uncompressedText;
};




function* arrayGenerator(array) {
	for (const elmnt of array) {
		yield elmnt;
	}
}

const urls = [
		"https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"
	];

export async function loadJs(generator=arrayGenerator(urls)) {
	const {value: currentUrl, done} = generator.next();
	if(done) {
		return true;
	}

	const scriptElmnt = document.createElement("script");
	scriptElmnt.setAttribute("src", currentUrl);
	document.head.appendChild(scriptElmnt);
	await (() => {
		return new Promise(scrLoaded => {
			scriptElmnt.addEventListener("load", scrLoaded);
		});
	})();

	return await loadJs(generator);

}
