window.norientationchange = function() { 
      if(window.innerHeight > window.innerWidth){
           window.location.replace('demo.html');
}else{
 window.location.replace('index.html');
}
};
