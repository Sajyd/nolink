"use strict";var u=Object.defineProperty;var g=Object.getOwnPropertyDescriptor;var h=Object.getOwnPropertyNames;var w=Object.prototype.hasOwnProperty;var b=(t,e)=>{for(var n in e)u(t,n,{get:e[n],enumerable:!0})},S=(t,e,n,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of h(e))!w.call(t,r)&&r!==n&&u(t,r,{get:()=>e[r],enumerable:!(i=g(e,r))||i.enumerable});return t};var y=t=>S(u({},"__esModule",{value:!0}),t);var E={};b(E,{NolinkAccessButton:()=>v});module.exports=y(E);var o=require("vue");var d=null;function k(){if(!d)throw new Error("nolink-sdk: appelle init() avant d'utiliser le SDK");return d}function p(t,e={}){let n=k(),i=t.trim();if(!i)throw new Error("nolink-sdk: serviceId requis");let r=e.buttonText??"Acc\xE8s imm\xE9diat",m=e.color??n.primaryColor??"#6366f1",s=document.createElement("button");s.type="button",s.textContent=r,s.style.cssText=`
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    background-color: ${m};
    color: white;
    border: none;
    cursor: pointer;
  `,s.setAttribute("data-nolink-button",i),s.addEventListener("click",()=>{let a=window.location.href,l=new URLSearchParams;l.set("embed","1"),l.set("return_url",a),e.planId&&l.set("plan",e.planId);let f=`${n.baseUrl}/s/${encodeURIComponent(i)}?${l.toString()}`;window.location.href=f});let c=e.mountTarget;if(c){let a=typeof c=="string"?document.querySelector(c):c;a&&a.appendChild(s)}return s}var v=(0,o.defineComponent)({name:"NolinkAccessButton",props:{serviceId:{type:String,required:!0},buttonText:String,planId:String,color:String},setup(t){let e=(0,o.ref)(null),n=null;return(0,o.onMounted)(()=>{e.value&&(n=p(t.serviceId,{buttonText:t.buttonText,planId:t.planId,color:t.color??void 0,mountTarget:e.value}))}),(0,o.onUnmounted)(()=>{n?.remove()}),()=>(0,o.h)("div",{ref:e})}});0&&(module.exports={NolinkAccessButton});
