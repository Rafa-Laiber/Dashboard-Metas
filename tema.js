// Aplica o tema escolhido (claro/escuro) antes de desenhar a página, para não piscar.
(function(){try{var t=localStorage.getItem("metas_tema");if(t==="claro")document.documentElement.setAttribute("data-theme","light");else if(t==="escuro")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})();
