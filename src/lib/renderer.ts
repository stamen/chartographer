import type { FeatureCollection } from 'geojson';

// ---------------------------------------------------------------------------
// Shared MapLibre renderer
//
// Each page (fills, lines) uses one RenderQueue — a single hidden MapLibre
// map with preserveDrawingBuffer:true. Layers are rendered sequentially:
// swap the style layer, wait for idle, capture canvas.toDataURL(), resolve.
//
// This keeps the WebGL context count to one per page regardless of how many
// layers the loaded style contains.
// ---------------------------------------------------------------------------

interface RenderJob {
	layerId: string;
	layerType: 'fill' | 'line';
	paint: Record<string, unknown>;
	layout: Record<string, unknown>;
	geojson: FeatureCollection;
	backgroundColor: string;
	width: number;
	height: number;
	resolve: (dataUrl: string) => void;
	reject: (err: Error) => void;
}

export class RenderQueue {
	private queue: RenderJob[] = [];
	private busy = false;
	private map: import('maplibre-gl').Map | null = null;
	private container: HTMLDivElement | null = null;
	private mapWidth = 0;
	private mapHeight = 0;

	enqueue(job: Omit<RenderJob, 'resolve' | 'reject'>): Promise<string> {
		return new Promise((resolve, reject) => {
			this.queue.push({ ...job, resolve, reject });
			if (!this.busy) this.drain();
		});
	}

	private async drain() {
		this.busy = true;
		while (this.queue.length > 0) {
			const job = this.queue.shift()!;
			try {
				const url = await this.renderOne(job);
				job.resolve(url);
			} catch (err) {
				job.reject(err instanceof Error ? err : new Error(String(err)));
			}
		}
		this.busy = false;
	}

	private async renderOne(job: RenderJob): Promise<string> {
		const maplibre = await import('maplibre-gl');

		const needsResize = job.width !== this.mapWidth || job.height !== this.mapHeight;

		if (!this.map || !this.container) {
			// First use — create the hidden off-screen container and map.
			this.container = document.createElement('div');
			Object.assign(this.container.style, {
				position: 'fixed',
				left: '-99999px',
				top: '0',
				width: `${job.width}px`,
				height: `${job.height}px`,
				visibility: 'hidden'
			});
			document.body.appendChild(this.container);
			this.mapWidth = job.width;
			this.mapHeight = job.height;

			const fitZoom = Math.log2(job.width / 512);

			this.map = new maplibre.Map({
				container: this.container,
				style: {
					version: 8,
					sources: {
						'zoom-segments': { type: 'geojson', data: job.geojson }
					},
					layers: [
						{
							id: 'background',
							type: 'background',
							paint: { 'background-color': job.backgroundColor }
						},
						{
							id: '__layer__',
							type: job.layerType as 'fill' | 'line',
							source: 'zoom-segments',
							layout: job.layout as never,
							paint: job.paint as never
						}
					]
				},
				center: [0, 0],
				zoom: fitZoom,
				renderWorldCopies: false,
				interactive: false,
				attributionControl: false,
				// preserveDrawingBuffer is required for toDataURL() after the frame.
				// In MapLibre v5 this moved under canvasContextAttributes.
				canvasContextAttributes: { preserveDrawingBuffer: true }
			});

			await new Promise<void>((res, rej) => {
				this.map!.once('load', () => res());
				this.map!.once('error', (e) => rej(e.error ?? new Error('map load error')));
			});
		} else {
			// Subsequent use — update the existing map in place.
			if (needsResize) {
				this.container.style.width = `${job.width}px`;
				this.container.style.height = `${job.height}px`;
				this.mapWidth = job.width;
				this.mapHeight = job.height;
				this.map.resize();
			}

			// Update the GeoJSON source data (same for all layers of a type,
			// but we pass it through to keep the API simple).
			(this.map.getSource('zoom-segments') as import('maplibre-gl').GeoJSONSource).setData(
				job.geojson
			);

			// Swap the background color.
			this.map.setPaintProperty('background', 'background-color', job.backgroundColor);

			// Replace the content layer with fresh paint + layout for this job.
			this.map.removeLayer('__layer__');
			this.map.addLayer({
				id: '__layer__',
				type: job.layerType,
				source: 'zoom-segments',
				layout: job.layout,
				paint: job.paint
			} as Parameters<typeof this.map.addLayer>[0]);

			// Fit zoom in case width changed.
			if (needsResize) {
				const fitZoom = Math.log2(job.width / 512);
				this.map.setZoom(fitZoom);
			}
		}

		// Wait for the frame to finish rendering.
		await new Promise<void>((res, rej) => {
			const onError = (e: { error?: Error }) =>
				rej(e.error ?? new Error('render error'));
			this.map!.once('idle', () => {
				this.map!.off('error', onError);
				res();
			});
			this.map!.once('error', onError);
		});

		return this.map!.getCanvas().toDataURL();
	}

	destroy() {
		this.map?.remove();
		this.container?.remove();
		this.map = null;
		this.container = null;
		this.mapWidth = 0;
		this.mapHeight = 0;
	}
}
