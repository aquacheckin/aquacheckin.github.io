// Get HTML head element 
var head = document.getElementsByTagName('HEAD')[0];  
  
// Create new link Element 
var link = document.createElement('link'); 
  
// set the attributes for link element  
link.rel = 'stylesheet';  
      
link.type = 'text/css'; 
      
link.href = 'lock.css';  
  
if ((navigator.userAgent.match(/iPhone/)) || (navigator.userAgent.match(/iPod/))) {
// Append link element to HTML head 
head.appendChild(link);  
}

if (navigator.userAgent.match(/Android/)) {
// Append link element to HTML head 
head.appendChild(link);  
}
