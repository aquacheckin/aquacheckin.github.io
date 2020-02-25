window.onload=function(){
    var mobile = (/iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(navigator.userAgent.toLowerCase()));
    if (mobile) {
        window.onorientationchange = function() { 
  if(window.innerHeight > window.innerWidth){
}else{
 window.location.replace('index.html');
}
};
  }
