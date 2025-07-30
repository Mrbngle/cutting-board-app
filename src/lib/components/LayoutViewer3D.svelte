<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { LayoutResult } from '$lib/utils/optimizer';
	import { get } from 'svelte/store';
	import { boardStore } from '$lib/stores/boardStore';

	export let layoutResult: LayoutResult | null = null;

	let container: HTMLDivElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.OrthographicCamera;
	let controls: OrbitControls;
	let animationFrameId: number;

	// --- NEW: State for board toggling ---
	let activeBoardIndex = 0;
	// Array to hold the THREE.Group for each board
	let boardGroups: THREE.Group[] = [];

	// getPieceColor helper function (as before)
	function getPieceColor(idOrName: string): string {
		const colors = [
			'#a6cee3',
			'#1f78b4',
			'#b2df8a',
			'#33a02c',
			'#fb9a99',
			'#e31a1c',
			'#fdbf6f',
			'#ff7f00',
			'#cab2d6',
			'#6a3d9a',
			'#ffff99',
			'#b15928'
		];
		let hash = 0;
		for (let i = 0; i < idOrName.length; i++) {
			hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	onMount(() => {
		// --- Basic Three.js Scene Setup (as before) ---
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xdee2e6);
		const aspect = container.clientWidth / container.clientHeight;
		const frustumSize = layoutResult?.boardDimensions.widthMm || 2500;
		camera = new THREE.OrthographicCamera(
			(frustumSize * aspect) / -2,
			(frustumSize * aspect) / 2,
			frustumSize / 2,
			frustumSize / -2,
			1,
			10000
		);
		camera.position.set(500, 800, 500);
		camera.lookAt(0, 0, 0);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		container.appendChild(renderer.domElement);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
		scene.add(ambientLight);
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(200, 500, 300);
		scene.add(directionalLight);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;

		const handleResize = () => {
			/* ... (as before) ... */
		};
		window.addEventListener('resize', handleResize);

		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			controls.update();
			renderer.render(scene, camera);
		};
		animate();

		// --- Cleanup Function ---
		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationFrameId);
			controls.dispose();
			// Dispose of geometries and materials in all board groups
			boardGroups.forEach((group) => {
				group.traverse((object) => {
					if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
						object.geometry.dispose();
						if (Array.isArray(object.material)) {
							object.material.forEach((m) => m.dispose());
						} else {
							object.material.dispose();
						}
					}
				});
				scene.remove(group);
			});
			renderer.dispose();
		};
	});

	// --- Reactive statement to draw the layout ---
	$: if (layoutResult && scene) {
		// 1. Clean up old layout objects
		boardGroups.forEach((group) => {
			group.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
					object.geometry.dispose();
					if (Array.isArray(object.material)) {
						object.material.forEach((m) => m.dispose());
					} else {
						object.material.dispose();
					}
				}
			});
			scene.remove(group);
		});
		boardGroups = []; // Reset the array
		activeBoardIndex = 0; // Reset to the first board

		// 2. Get board dimensions
		const { widthMm: boardW, lengthMm: boardL } = layoutResult.boardDimensions;
		const { thicknessMm: boardT } = get(boardStore);

		// 3. Create 3D objects for each board and its pieces
		for (let i = 0; i < layoutResult.boardsUsed; i++) {
			const boardGroup = new THREE.Group(); // Group for this board and its pieces

			// Create the board mesh
			const boardGeo = new THREE.BoxGeometry(boardW, boardT, boardL);
			const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
			const boardMesh = new THREE.Mesh(boardGeo, boardMat);
			boardMesh.position.set(boardW / 2, -boardT / 2, boardL / 2);
			boardGroup.add(boardMesh);

			// Create meshes for pieces on this board
			const piecesOnThisBoard = layoutResult.placedPieces.filter((p) => p.boardIndex === i);
			for (const piece of piecesOnThisBoard) {
				const pieceT = boardT + 1; // Slightly thicker to avoid visual glitches
				const pieceGeo = new THREE.BoxGeometry(piece.placedWidthMm, pieceT, piece.placedLengthMm);
				const pieceMat = new THREE.MeshStandardMaterial({
					color: getPieceColor(piece.name || piece.id),
					roughness: 0.5
				});
				const pieceMesh = new THREE.Mesh(pieceGeo, pieceMat);

				// --- NEW: Create borders for the piece ---
				const edges = new THREE.EdgesGeometry(pieceGeo);
				const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }); // Black border
				const borders = new THREE.LineSegments(edges, lineMat);

				// Position the piece and its borders together
				const pieceGroup = new THREE.Group();
				pieceGroup.add(pieceMesh);
				pieceGroup.add(borders);

				// Position the group on top of the board
				pieceGroup.position.set(
					piece.x + piece.placedWidthMm / 2,
					pieceT / 2, // Place top surface at y=0, centered on y=0
					piece.y + piece.placedLengthMm / 2
				);
				boardGroup.add(pieceGroup);
			}
			boardGroups.push(boardGroup); // Add the complete board group to our array
			scene.add(boardGroup); // Add to the main scene
		}

		// 4. Adjust camera to fit the first board layout
		if (boardGroups.length > 0) {
			const box = new THREE.Box3().setFromObject(boardGroups[0]);
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3());
			const maxDim = Math.max(size.x, size.y, size.z);

			const aspect = container.clientWidth / container.clientHeight;
			camera.left = (maxDim * aspect) / -2;
			camera.right = (maxDim * aspect) / 2;
			camera.top = maxDim / 2;
			camera.bottom = maxDim / -2;
			camera.zoom = 0.95; // Add padding
			camera.updateProjectionMatrix();

			controls.target.copy(center);
			controls.update();
		}
	}

	// --- NEW: Reactive statement to toggle board visibility ---
	$: if (boardGroups.length > 0) {
		boardGroups.forEach((group, i) => {
			group.visible = i === activeBoardIndex;
		});
	}
</script>

{#if layoutResult && layoutResult.boardsUsed > 1}
	<div class="board-toggle-controls">
		<span>Showing Board:</span>
		{#each { length: layoutResult.boardsUsed } as _, i}
			<button on:click={() => (activeBoardIndex = i)} class:active={activeBoardIndex === i}>
				{i + 1}
			</button>
		{/each}
	</div>
{/if}

<div class="viewer-3d-container" bind:this={container}></div>

<style>
	/* --- NEW: Board Toggle Styles --- */
	.board-toggle-controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}
	.board-toggle-controls button {
		padding: 0.3rem 0.8rem;
		min-width: 30px;
		border: 1px solid #ccc;
		background-color: #f8f9fa;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.board-toggle-controls button.active {
		background-color: #007bff;
		color: white;
		border-color: #007bff;
		font-weight: bold;
	}
	.board-toggle-controls button:hover:not(.active) {
		background-color: #e2e6ea;
	}

	/* --- Container Styles (as before) --- */
	.viewer-3d-container {
		width: 100%;
		height: 600px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		background-color: #e9ecef;
		cursor: grab;
	}
	.viewer-3d-container:active {
		cursor: grabbing;
	}
</style>
