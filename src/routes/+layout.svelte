<script>
	// We can add imports and logic for theme switching here later.
	function handleToggleTheme() {
		// Placeholder function - actual theme logic will come later
		console.log('Toggle theme button clicked');
		alert('Theme switching not implemented yet!');
	}
</script>

<div class="app-layout">
	<header class="app-header">
		<div class="logo-title">
			<h1>Plywood Optimizer</h1>
		</div>
		<nav class="app-nav">
			<button on:click={handleToggleTheme}> Toggle Theme </button>
		</nav>
	</header>

	<main class="app-main-content">
		<slot />
	</main>

	<footer class="app-footer">
		<p>&copy; {new Date().getFullYear()} Plywood Optimizer. All rights reserved.</p>
	</footer>
</div>

<style lang="scss" src="./+layout.scss"></style>
