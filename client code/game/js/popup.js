export default class Popup {
	fire(html, ops) {
    ops = ops ?? {};

	  let self = this;
	  return new Promise(resolve => {
      document.body.style.filter = "blur(5px)";

	    var title = document.createElement("h1");
	    title.classList.add("title");
	    title.style.paddingBottom = "15px";
	    title.style.fontWeight = "100";
	    title.innerHTML = ops.title ?? "<h1 style='color:transparent; pointer-events: none;'>Placeholder</h1>";

	    let controls = document.createElement("div");
	    controls.classList.add("popup-actions");
	    controls.style.position = "sticky";
	    controls.style.bottom = "4px";
	    controls.style.marginTop = "35px";
	    controls.style.marginBottom = "25px";
	    controls.style.background = "rgba(255,255,255,0.7)";
	    controls.style.display = "inline-block";
	    controls.style.borderRadius = "50px";
	    controls.style.padding = "0px";
	    controls.style.width = "90%";
	    //controls.style.marginLeft = "50%";
	    //controls.style.transform = "translateX(-50%)";




	    let cancel_button = document.createElement("button");
	    cancel_button.classList.add("blue-text-btn");
	    cancel_button.classList.add("popup-cancel");
	    cancel_button.innerHTML = ops.cancel_button_text || "Cancel";
	    cancel_button.style.borderRadius = "50px 0px 0px 50px";
	    cancel_button.onclick = () => {popup_document_click_handler(true); resolve({value: false, dismiss: "Cancel", content: box})};

	    let confirm_button = document.createElement("button");
	    confirm_button.classList.add("blue-text-btn");
	    confirm_button.classList.add("popup-confirm");
	    confirm_button.innerHTML = ops.confirm_button_text || "Confirm";
	    confirm_button.style.borderRadius = "0px 50px 50px 0px";
	    confirm_button.onclick = () => {popup_document_click_handler(true); resolve({value: true, dismiss: "Confirm", content: box});}

	    if(!ops.hide_cancel_button) controls.appendChild(cancel_button);
	    if(!ops.hide_confirm_button) controls.appendChild(confirm_button);
	    if(ops.additional_controls) {
	      ops.additional_controls.classList.add("additional_controls"); 
	      controls.appendChild(ops.additional_controls);
	    }


	    var box = document.createElement("div"); // this is the popup
	    box.classList.add("popup");
	    box.classList.add("scroll4");
	    box.appendChild(title);
	    if(html) try {box.appendChild(html)} catch(er) {
	    	try {
	    		box.innerHTML += html;
	    	} catch(er) {}
	    };
	    box.appendChild(controls);
	    if(ops.width) box.style.width = ops.width;
	    document.documentElement.appendChild(box);


	    function popup_document_click_handler(remove) {
	      let e = window.event;
	      let more_popups = document.querySelectorAll(".popup").length > 1;
        
        let delay = more_popups ? 350 : 0;

      	  if(!e.target.classList.contains("popup") && !(e.target.closest(".popup"))) {
		      	if(!more_popups) {
              document.querySelector(".popup").style.transform = "translateY(-30vh)";
			        setTimeout(function() {
                document.body.style.filter = "blur(0px)";
                try { document.documentElement.removeChild(container); } catch(er) {}
                try { document.documentElement.removeEventListener("click", popup_document_click_handler); } catch(er) {}
              }, 350);
			    }
			    try { document.documentElement.removeChild(box); } catch(er) {}
		        setTimeout(function() {
              resolve({value: false, dismiss: "Backdrop", content: box});
            }, delay);
		      } else if(e.target.classList.contains("additional_controls")) {
		        setTimeout(function() {
              if(!more_popups) {
                document.body.style.filter = "blur(0px)";
                try { document.documentElement.removeChild(container); } catch(er){}
                document.documentElement.removeEventListener("click", popup_document_click_handler);
            }
            try { document.documentElement.removeChild(box); } catch(er){}

              resolve({value: true, dismiss: "Additional controls"});
            }, delay);
		      }
		      setTimeout(function() {
            if(remove == true) {

              if(e.target.classList.contains("popup-confirm") && ops.load_on_confirm) {
                e.target.innerHTML = "Loading";
                e.target.classList.add("popup-confirm-loading");
              } else {
                if(!more_popups) {
                  document.body.style.filter = "";
                  try { document.documentElement.removeChild(container); } catch(er){}
                  document.documentElement.removeEventListener("click", popup_document_click_handler);
                }
                try { document.documentElement.removeChild(box); } catch(er){}
              }
            }
          }, delay);
	    }

	    setTimeout(() => {
	      document.documentElement.addEventListener("click", popup_document_click_handler);
	    }, 100);
	  })
	}

	close() {
	  return new Promise(resolve => {
	  	let more_popups = document.querySelectorAll(".popup").length > 1;
	  	if(!more_popups) {
		    document.body.style.filter = "";
		}
		try { document.querySelector(".popup").parentElement.removeChild(document.querySelector(".popup")); } catch(er){console.error(er);};
	    resolve({value: true, dismiss: "Closed by script"});
	  });
	}

	still_loading() {
	  let confirm_button = document.querySelector(".popup-confirm");
	  return confirm_button?.classList?.contains("popup-confirm-loading");
	}

	stop_loading() {
	  document.querySelector(".popup-confirm-loading")?.remove("popup-confirm-loading");
	  return document.querySelector(".popup-confirm-loading") || false;
	}
}