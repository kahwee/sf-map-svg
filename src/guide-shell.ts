/** Shared compact-embed geometry; keep server and mounted frames identical. */
export const guideShellCSS = `
.sf-guide-shell{max-width:1120px;margin:auto}
.sf-guide-shell .sf-guide-frame{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:64px auto auto 44px minmax(40px,auto);border:1px solid #cedae3;border-radius:14px;overflow:hidden;margin:0;max-width:none;font:14px/1.5 system-ui,sans-serif}
.sf-guide-shell .sf-guide-frame[data-interface] .sf-explorer-body,.sf-guide-shell .sf-guide-frame .sf-explorer-map-column{display:contents}
.sf-guide-shell .sf-explorer-toolbar{grid-row:1;flex-wrap:nowrap;overflow-x:auto;padding:8px;margin:0}
.sf-guide-shell .sf-explorer-control-group{flex-wrap:nowrap;max-width:none;flex-shrink:0}
.sf-guide-shell .sf-explorer-toolbar button{white-space:nowrap}
.sf-guide-shell .sf-explorer-feature-controls{grid-row:2}
.sf-guide-shell .sf-guide-placeholder:nth-child(3){grid-row:4}
.sf-guide-shell .sf-explorer-canvas{grid-row:3;aspect-ratio:1;min-width:0}
.sf-guide-shell .sf-explorer-canvas>svg{display:block;width:100%;height:100%}
.sf-guide-shell .sf-explorer-legend{grid-row:4;flex-wrap:nowrap;overflow-x:auto;padding:10px 14px;align-items:center;margin:0}
.sf-guide-shell .sf-guide-sources{grid-row:5;box-sizing:border-box;min-height:40px;padding:8px 14px;margin:0;font:12px/24px system-ui,sans-serif;background:#fff;color:#496578}
.sf-guide-shell .sf-guide-placeholder{box-sizing:border-box;padding:12px 14px;background:#fff;color:#496578}
`;
