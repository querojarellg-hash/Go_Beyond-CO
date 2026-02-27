let cart=[];
let total=0;
let token="";

/* CUSTOMER */

function startOrder(){
document.getElementById("welcomeScreen").style.display="none";
document.getElementById("orderScreen").style.display="block";
loadMenu();
}

function loadMenu(){
fetch("/menu")
.then(res=>res.json())
.then(data=>{
let html="";
data.forEach(item=>{
html+=`
<div class="card menu-item">
<span>${item.name}</span>
<span>₱${item.price}
<button onclick="addItem('${item.name}',${item.price})">Add</button>
</span>
</div>`;
});
document.getElementById("menuList").innerHTML=html;
});
}

function addItem(name,price){
cart.push({name,price});
total+=price;
document.getElementById("total").innerText=total;
}

function checkout(){
fetch("/order",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({items:cart,total})
}).then(()=>{
alert("Order placed successfully!");
location.reload();
});
}

/* ADMIN */

function login(){
fetch("/login",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
username:document.getElementById("username").value,
password:document.getElementById("password").value
})
})
.then(res=>res.json())
.then(data=>{
if(data.token){
token=data.token;
document.getElementById("loginScreen").style.display="none";
document.getElementById("dashboardScreen").style.display="block";
loadQR();
loadOrders();
}else{
alert("Login Failed");
}
});
}

function loadQR(){
fetch("/generate-qr")
.then(res=>res.json())
.then(data=>{
document.getElementById("qr").src=data.qr;
});
}

function loadOrders(){
fetch("/orders",{headers:{authorization:token}})
.then(res=>res.json())
.then(data=>{
let html="";
data.forEach(o=>{
html+=`
<div class="card">
<strong>${o.orderNumber}</strong><br>
Total: ₱${o.total}<br>
Status: <span class="status-${o.status}">${o.status}</span><br>
<button onclick="updateStatus(${o.id},'accepted')">Accept</button>
<button onclick="updateStatus(${o.id},'done')">Done</button>
</div>`;
});
document.getElementById("orders").innerHTML=html;
});
}

function updateStatus(id,status){
fetch("/order/status/"+id,{
method:"POST",
headers:{
"Content-Type":"application/json",
authorization:token
},
body:JSON.stringify({status})
}).then(()=>loadOrders());
}

setInterval(()=>{
if(token) loadOrders();
},4000);
