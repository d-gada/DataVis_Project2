class BarChart {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      field:         _config.field,
      sourceKey:     _config.sourceKey,
      margin: { top: 10, right: 20, bottom: 30, left: 160 }
    };
    this.data         = _data;
    this.dispatcher   = _dispatcher;
    this.selectedLabel = null;
    this.initVis();
  }

  initVis() {
    let vis = this;

    vis.svg = d3.select(vis.config.parentElement)
      .append('svg')
      .append('g')
        .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.xScale = d3.scaleLinear();
    vis.yScale = d3.scaleBand().padding(0.2);

    vis.xAxisG = vis.svg.append('g').attr('class', 'axis x-axis');
    vis.yAxisG = vis.svg.append('g').attr('class', 'axis y-axis');

    vis.updateVis(vis.data);
  }

  updateVis(data) {
    let vis = this;
    vis.data = data;

    const counts = d3.rollup(vis.data.filter(d => d[vis.config.field]), v => v.length, d => d[vis.config.field]);
    vis.chartData = Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    vis.renderVis();
  }

  renderVis() {
    let vis = this;
    const m = vis.config.margin;
    const containerW = document.querySelector(vis.config.parentElement).clientWidth;
    const barH = 22;

    vis.width  = containerW - m.left - m.right;
    vis.height = vis.chartData.length * (barH + 6);

    d3.select(vis.config.parentElement).select('svg')
      .attr('width',  containerW)
      .attr('height', vis.height + m.top + m.bottom);

    vis.xScale.domain([0, d3.max(vis.chartData, d => d.count)]).nice().range([0, vis.width]);
    vis.yScale.domain(vis.chartData.map(d => d.label)).range([0, vis.height]);

    vis.xAxisG.attr('transform', `translate(0,${vis.height})`).call(d3.axisBottom(vis.xScale).ticks(4).tickFormat(d3.format('d')));
    vis.yAxisG.call(d3.axisLeft(vis.yScale));

    const bars = vis.svg.selectAll('.bar').data(vis.chartData, d => d.label);

    bars.enter().append('rect').attr('class', 'bar').attr('rx', 2)
      .merge(bars)
        .attr('y',      d => vis.yScale(d.label))
        .attr('height', vis.yScale.bandwidth())
        .attr('x', 0)
        .attr('width',  d => vis.xScale(d.count))
        .attr('fill',   d => d.label === vis.selectedLabel ? '#0e2f4e' : '#4a7fa5')
        .style('cursor', 'pointer')
        .on('click', function(event, d) {
          if (vis.selectedLabel === d.label) {
            vis.selectedLabel = null;
            vis.dispatcher.call('selectionChanged', null, allData, vis.config.sourceKey);
          } else {
            vis.selectedLabel = d.label;
            const filtered = allData.filter(r => r[vis.config.field] === d.label);
            vis.dispatcher.call('selectionChanged', null, filtered, vis.config.sourceKey);
          }
          vis.renderVis();
        })
        .on('mouseover', function(event, d) {
          if (d.label !== vis.selectedLabel) d3.select(this).attr('fill', '#2a649b');
          d3.select('#tooltip').style('opacity', 1)
            .html(`<div class="tooltip-title">${d.label}</div><div><strong>Requests:</strong> ${d.count}</div>`);
        })
        .on('mousemove', event => {
          d3.select('#tooltip').style('left', (event.pageX + 12) + 'px').style('top', (event.pageY + 12) + 'px');
        })
        .on('mouseleave', function(event, d) {
          d3.select(this).attr('fill', d.label === vis.selectedLabel ? '#0e2f4e' : '#4a7fa5');
          d3.select('#tooltip').style('opacity', 0);
        });

    bars.exit().remove();

    const labels = vis.svg.selectAll('.bar-label').data(vis.chartData, d => d.label);
    labels.enter().append('text').attr('class', 'bar-label')
      .merge(labels)
        .attr('x', d => vis.xScale(d.count) + 4)
        .attr('y', d => vis.yScale(d.label) + vis.yScale.bandwidth() / 2 + 4)
        .text(d => d.count);
    labels.exit().remove();
  }
}