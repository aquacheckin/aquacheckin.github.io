window.onload=function(){
    var mobile = (/iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(navigator.userAgent.toLowerCase()));
    if (mobile) {
        if(window.innerHeight > window.innerWidth){
    window.location.replace('demo.html');
    alert("Please rotate phone to landscape mode for best experience");  
}            
    } else {
window.location.replace('index.html');
    }
  }

window.onorientationchange = function() { 
  if(window.innerHeight > window.innerWidth){
     alert("Please rotate phone to landscape mode for best experience");  
    window.location.replace('demo.html');
}else{
 window.location.replace('index.html');
}
};
