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
//
// Canvases render with a transparent background wherever nothing is drawn
// (there's no background/backdrop layer here) — the shared background swatch
// behind the whole bar list (see BackgroundSwatch.svelte) shows through those
// gaps, rather than every bar baking its own copy of it into its own capture.
// ---------------------------------------------------------------------------

interface RenderJob {
	layerId: string;
	layerType: 'fill' | 'line';
	paint: Record<string, unknown>;
	layout: Record<string, unknown>;
	geojson: FeatureCollection;
	width: number;
	height: number;
	resolve: (dataUrl: string) => void;
	reject: (err: Error) => void;
}

// "Cross-faded" paint properties (line-dasharray, *-pattern) maintain their
// own atlas/texture state behind the scenes. Toggling one of these between a
// data-driven expression and a plain/absent value on the SAME live layer
// permanently corrupts that layer's render state in MapLibre: every
// subsequent frame throws deep inside a uniform setter and 'idle' never
// fires again, hanging that render job (and every job queued behind it)
// forever. Recreating the layer (remove + add) avoids this. We don't do that
// for every job — see the comment at the mutate-in-place branch below — only
// when one of these properties is actually changing shape.
const CROSS_FADED_PAINT_PROPS = [
	'line-dasharray',
	'line-pattern',
	'fill-pattern',
	'fill-extrusion-pattern'
];

function isExpressionValue(value: unknown): boolean {
	return Array.isArray(value) && typeof value[0] === 'string';
}

export class RenderQueue {
	private queue: RenderJob[] = [];
	private busy = false;
	private map: import('maplibre-gl').Map | null = null;
	private container: HTMLDivElement | null = null;
	private mapWidth = 0;
	private mapHeight = 0;
	private prevPaint: Record<string, unknown> = {};
	private prevLayout: Record<string, unknown> = {};

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

			const needsRecreate = CROSS_FADED_PAINT_PROPS.some(
				(key) => isExpressionValue(this.prevPaint[key]) !== isExpressionValue(job.paint[key])
			);

			if (needsRecreate) {
				// Let the setData() mutation above fully settle before tearing
				// down the layer — recreating it while a source reload is
				// still in flight is what causes a rare, non-fatal,
				// self-recovering console error here.
				await this.waitIdle();

				// See CROSS_FADED_PAINT_PROPS above — mutating in place here
				// permanently corrupts this layer's render state in MapLibre.
				this.map.removeLayer('__layer__');
				this.map.addLayer({
					id: '__layer__',
					type: job.layerType,
					source: 'zoom-segments',
					layout: job.layout,
					paint: job.paint
				} as Parameters<typeof this.map.addLayer>[0]);
			} else {
				// Mutate the existing layer's paint/layout in place rather
				// than remove+add — removing the layer destroys its bucket
				// mid-frame, and a render already queued by setData()/
				// setPaintProperty() above can fire against the half-torn-
				// down layer, throwing deep inside MapLibre's uniform
				// setters (undefined color arrays).
				const paintKeys = new Set(Object.keys(job.paint));
				for (const key of Object.keys(this.prevPaint)) {
					if (!paintKeys.has(key)) this.map.setPaintProperty('__layer__', key, undefined);
				}
				for (const [key, value] of Object.entries(job.paint)) {
					this.map.setPaintProperty('__layer__', key, value);
				}

				const layoutKeys = new Set(Object.keys(job.layout));
				for (const key of Object.keys(this.prevLayout)) {
					if (!layoutKeys.has(key)) this.map.setLayoutProperty('__layer__', key, undefined);
				}
				for (const [key, value] of Object.entries(job.layout)) {
					this.map.setLayoutProperty('__layer__', key, value);
				}
			}

			// Fit zoom in case width changed.
			if (needsResize) {
				const fitZoom = Math.log2(job.width / 512);
				this.map.setZoom(fitZoom);
			}
		}

		this.prevPaint = job.paint;
		this.prevLayout = job.layout;

		await this.waitIdle();

		return this.map!.getCanvas().toDataURL();
	}

	private waitIdle(): Promise<void> {
		return new Promise<void>((res, rej) => {
			const onError = (e: { error?: Error }) => rej(e.error ?? new Error('render error'));
			this.map!.once('idle', () => {
				this.map!.off('error', onError);
				res();
			});
			this.map!.once('error', onError);
		});
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
