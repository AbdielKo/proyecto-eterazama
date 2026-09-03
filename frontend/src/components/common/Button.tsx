interface Props{

children:React.ReactNode;

onClick?:()=>void;

}


function Button({
children,
onClick
}:Props){


return (

<button

onClick={onClick}

style={{

background:"#0284c7",

color:"white",

padding:"12px 20px",

border:"none",

borderRadius:"10px",

cursor:"pointer"

}}

>

{children}

</button>


);


}


export default Button;