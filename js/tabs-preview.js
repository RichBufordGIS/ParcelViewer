(() =>
{
	const tabButtons=Array
		.from(document.querySelectorAll(".header-tabs .header-tab"))
		.filter(Boolean);

	if(tabButtons.length===0) return;

	function setActiveTab(btn)
	{
		tabButtons.forEach(b =>
		{
			const on=b===btn;
			b.classList.toggle("active",on);
			b.setAttribute("aria-selected",on ? "true" : "false");
		});
	}

	tabButtons.forEach(btn =>
	{
		btn.addEventListener("click",() => setActiveTab(btn));
	});
})();

