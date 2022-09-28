// const getSvg = () => {
//     <svg id="fill" width={CHART_WIDTH} height={chartHeight}>
//     <defs>
//       {#each gradients as gradient}
//         <linearGradient id={gradient.id}>
//           {#each gradient.stops as stop}
//             <stop
//               offset={stop.offset}
//               stop-color={stop.stopColor}
//               stop-opacity={stop.stopOpacity}
//             />
//           {/each}
//         </linearGradient>
//       {/each}
//     </defs>
//     <g>
//       {#each rects as rect}
//         <rect
//           x={rect.x}
//           y={rect.y}
//           width={rect.width}
//           height={rect.layer.type === 'background'
//             ? chartHeight - MARGIN.top - MARGIN.bottom
//             : rect.height}
//           fill={rect.fill}
//           stroke={rect.stroke}
//           strokeWidth={rect.strokeWidth}
//           rx="20"
//           on:click={() => handleClick(rect.layer)}
//         />
//       {/each}
//     </g>

//     <g transform="translate(0, {MARGIN.top + scrollY})" class="x-axis">
//       {#each zoomLevels as zoomLevel}
//         <g
//           class="tick"
//           opacity="1"
//           transform="translate({xScale(zoomLevel)}, 0)"
//         >
//           <text y="9">
//             {zoomLevel}
//           </text>
//         </g>
//       {/each}
//     </g>

//     <g transform="translate(0, 0)" class="y-axis">
//       {#each rects as rect}
//         <g
//           class="tick"
//           opacity="1"
//           transform="translate(0,
//           {yScale(rect.layer.id) + yScale.bandwidth() / 2})"
//         >
//           {#each rect.layer.id.split('/') as idSection, i}<g>
//               {#if i === 0 && limitHit.includes(idSection)}
//                 <circle
//                   cx="6"
//                   cy="-6"
//                   r="6"
//                   fill="red"
//                   on:mouseover={() =>
//                     handleTooltipWarning(idSection, rect.layer.id)}
//                   on:mouseout={handleTooltipClose}
//                 />
//               {/if}
//               <text
//                 y={18 * i}
//                 x={(i > 0 ? 18 : 0) + limitHit.includes(idSection) ? 18 : 0}
//               >
//                 {#if i > 0}↳{/if}

//                 {idSection}</text
//               ></g
//             >
//           {/each}
//         </g>
//       {/each}
//     </g>
//   </svg>
// }
