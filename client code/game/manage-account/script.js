let header, payload, sig;

const jwt = localStorage.getItem("jwt");
if(!jwt) {
	document.getElementById("loading-screen").classList.add("hidden");
	showNotSignedInMsg();
} else {
	[header, payload, sig] = jwt.split(".").map((x, i) => {
		return i < 2 ? JSON.parse(atob(x)) : x;
	});


	validateJwt().then(response => {
		document.getElementById("loading-screen").classList.add("hidden");
		if(response.success) {
			useJwt();
		} else {
			showNotSignedInMsg();
		}
	}).catch(errr => {
		displayErrorScreen();
	});
}


async function validateJwt() {
	// send req validate-jwt
	return await $.ajax("https://shy-plum-bass-slip.cyclic.app/validate-jwt", {
		method: "POST",
		cache: false,
		data: {
			jwt
		}
	});
}

async function useJwt() {
	// use the jwt to fill in the greeting
	document.getElementById("signed-in-container").classList.remove("hidden");
	const username = payload.sub;

	// fill in elements with the user's username
	Array.from(document.getElementsByClassName("fill-in-un")).forEach(elmnt => {
		elmnt.innerText = username;
	});

	// get account data from server
	const accDetails = await getAccountDetails();
	if(!accDetails.success) {
		document.getElementById("signed-in-container").classList.add("hidden");
		showNotSignedInMsg();
		return;
	}
	// display those data
	displayAccDetails(accDetails.data);
}

function showNotSignedInMsg() {
	document.getElementById("not-signed-in-msg").classList.remove("hidden");
}

async function getAccountDetails() {
	return await $.ajax("https://shy-plum-bass-slip.cyclic.app/get-acc-details", {
		method: "POST",
		cache: false,
		data: {
			jwt
		}
	});
}

const dataKeyTranslator = {
	updated: "Last used",
	created: "Created",
	email: "Email",
	lockedAt: "Last locked",
	wrongPasswordCounter: "Wrong password attempts"
};
const dataValueTranslator = {
	updated: date => {
		const dateObj = new Date(date);
		return dateObj.getDate() + "/" + (dateObj.getMonth()+1) + "/" + dateObj.getFullYear()
	},
	created: date => {
		const dateObj = new Date(date);
		return dateObj.getDate() + "/" + (dateObj.getMonth()+1) + "/" + dateObj.getFullYear()
	},
	lockedAt: date => {
		const dateObj = new Date(date);
		return dateObj.getDate() + "/" + (dateObj.getMonth()+1) + "/" + dateObj.getFullYear()
	},
};
const dataErrorTranslator = {
	"account-locked": "Could not complete that action as the account is locked for a few minutes.",
	"unknown-error": "An unknown error occured, try again later",
	"email-not-found": "We couldn't find the email address you enterd",
	"wrong-credentials": "Wrong credentials"
};



function displayAccDetails(details) {
	if(!details) {
		return;
	}
	Object.entries(details).forEach(([key, value]) => {
		const newKey = dataKeyTranslator[key];
		if(newKey === undefined) {
			return;
		}
		const newVal = dataValueTranslator[key]?.(value) || value;
		addRow(newKey, newVal);
	});
}
function addRow(key, value) {
	const row = document.createElement("div");
	row.classList.add("row");

	const keyCol = document.createElement("div");
	keyCol.classList.add("col");
	keyCol.innerText = key;

	const valueCol = document.createElement("div");
	valueCol.classList.add("col");
	valueCol.innerText = value;

	row.appendChild(keyCol); // this first, so that it is on the left side
	row.appendChild(valueCol); // this second so it's on the right

	document.getElementById("account-details-container").appendChild(row);
}









function logOut() {
	localStorage.removeItem("jwt");
	location.assign("../../login");
}
function deleteAccountBtnClick() {
	// display the form to gather user inputs: password
	const form = document.getElementById("delete-acc-form");
	form.classList.remove("hidden");
}

function deleteAccountFormSubmit() {
	// user submitted form to delete acc
	const form = document.getElementById("delete-acc-form");
	const submitBtn = form.submit;
	if(submitBtn.classList.contains("danger")) {
		// delete acc
		sendDeleteAccountRequest(form.password.value, form.usernameOrEmail.value)
		.then(res => {
			console.log(res);
			if(res.success) {
				localStorage.removeItem("cached-username");
				localStorage.removeItem("jwt");
				location.assign("../../login");
			} else {
				const toast = new Toast({
					text: "Error: " + dataErrorTranslator[res.message],
				    position: "top-center",
				    pauseOnHover: true,
				    pauseOnFocusLoss: true,
				    success: false,
				    autoClose: 15000
				});
			}
		})
		.catch(er => {
			displayErrorScreen();
		});
	} else {
		submitBtn.classList.add("danger");
		submitBtn.value = "Delete account now";
	}
}
function cancelDeleteAccount() {
	document.getElementById("delete-acc-form").classList.add("hidden");
	document.getElementById("delete-acc-form").reset();
	document.getElementById("delete-acc-form").submit.classList.remove("danger");
	document.getElementById("delete-acc-form").submit.value = "I have read the above statement";
}


function displayErrorScreen() {
	document.getElementById("error-screen").classList.remove("hidden");
}

async function sendDeleteAccountRequest(passwordAttempt, usernameOrEmail) {
	const result = await $.ajax("https://shy-plum-bass-slip.cyclic.app/delete-account", {
		method: "POST",
		cache: false,
		data: {
			password: passwordAttempt,
			jwt,
			usernameOrEmail
		}
	});

	return result;
}