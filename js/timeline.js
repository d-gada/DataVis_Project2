class Timeline {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      margin: { top: 20, right: 30, bottom: 60, left: 60 }
    };

    this.data = _data;
    this.initVis();
  }

  initVis() {
    let vis = this;

    // ── Dimensions ────────────────────────────────────────────────────────────
    const container = document.querySelector(vis.config.parentElement);
    vis.width  = container.clientWidth  - vis.config.margin.left - vis.config.margin.right;
    vis.height = 260 - vis.config.margin.top - vis.config.margin.bottom;

    // ── SVG root ──────────────────────────────────────────────────────────────
    vis.svg = d3.select(vis.config.parentElement)
      .append('svg')
        .attr('width',  vis.width  + vis.config.margin.left + vis.config.margin.right)
        .attr('height', vis.height + vis.config.margin.top  + vis.config.margin.bottom)
      .append('g')
        .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // ── Scales ────────────────────────────────────────────────────────────────
    vis.xScale = d3.scaleBand()
      .range([0, vis.width])
      .padding(0.15);

    vis.yScale = d3.scaleLinear()
      .range([vis.height, 0]);

    // ── Axes ──────────────────────────────────────────────────────────────────
    vis.xAxisG = vis.svg.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.height})`);

    vis.yAxisG = vis.svg.append('g')
      .attr('class', 'axis y-axis');

    // Y-axis label
    vis.svg.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -vis.height / 2)
      .attr('y', -46)
      .attr('text-anchor', 'middle')
      .text('Number of requests');

    // X-axis label
    vis.svg.append('text')
      .attr('class', 'axis-label')
      .attr('x', vis.width / 2)
      .attr('y', vis.height + 52)
      .attr('text-anchor', 'middle')
      .text('Week of year (2025)');

    // ── Clip path so bars don't overflow ─────────────────────────────────────
    vis.svg.append('clipPath')
        .attr('id', 'timeline-clip')
      .append('rect')
        .attr('width', vis.width)
        .attr('height', vis.height);

    // ── Bar group ─────────────────────────────────────────────────────────────
    vis.barsG = vis.svg.append('g')
      .attr('clip-path', 'url(#timeline-clip)');

    vis.updateVis();
  }

  // Called whenever the underlying dataset changes (Level 4 brushing will use this).
  updateVis() {
    let vis = this;

    // ── Bin by ISO week ───────────────────────────────────────────────────────
    // d3.timeWeek.floor truncates any date to the Monday of its week, giving us
    // consistent weekly buckets regardless of day-of-week variation.
    const weeklyMap = d3.rollup(
      vis.data.filter(d => d.createdDate instanceof Date && !isNaN(d.createdDate)),
      v => v.length,
      d => d3.timeWeek.floor(d.createdDate)
    );

    // Convert Map → sorted array of { week, count } objects.
    vis.weeklyData = Array.from(weeklyMap, ([week, count]) => ({ week, count }))
      .sort((a, b) => a.week - b.week);

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    // ── Update scales ─────────────────────────────────────────────────────────
    vis.xScale.domain(vis.weeklyData.map(d => d.week));
    vis.yScale.domain([0, d3.max(vis.weeklyData, d => d.count)]).nice();

    // ── X axis — show only month labels to avoid overcrowding ─────────────────
    // We pick one tick per month by keeping the first week that falls within each
    // calendar month.
    const monthStarts = vis.weeklyData.filter((d, i) => {
      if (i === 0) return true;
      return d.week.getMonth() !== vis.weeklyData[i - 1].week.getMonth();
    });

    const monthFmt = d3.timeFormat('%b %Y');

    vis.xAxisG.call(
      d3.axisBottom(vis.xScale)
        .tickValues(monthStarts.map(d => d.week))
        .tickFormat(d => monthFmt(d))
    )
    .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end');

    vis.yAxisG.call(
      d3.axisLeft(vis.yScale).ticks(5).tickFormat(d3.format('d'))
    );

    // ── Bars ──────────────────────────────────────────────────────────────────
    // Design choice: a single desaturated steel-blue. The data attribute being
    // shown is quantitative (count over time), so no categorical color encoding
    // is needed here — the bar height encodes the value. A neutral hue avoids
    // implying any ranking or category distinction among weeks.
    const bars = vis.barsG.selectAll('.timeline-bar')
      .data(vis.weeklyData, d => d.week);

    const barsEnter = bars.enter()
      .append('rect')
        .attr('class', 'timeline-bar')
        .attr('fill', '#4a7fa5')
        .attr('rx', 2);

    barsEnter.merge(bars)
      .attr('x',      d => vis.xScale(d.week))
      .attr('y',      d => vis.yScale(d.count))
      .attr('width',  vis.xScale.bandwidth())
      .attr('height', d => vis.height - vis.yScale(d.count))
      // Highlight on hover
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill', '#0e2f4e');

        const weekEnd = new Date(d.week);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = d3.timeFormat('%b %d, %Y');

        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <div class="tooltip-title">Week of ${fmt(d.week)}</div>
            <div><strong>Week ending:</strong> ${fmt(weekEnd)}</div>
            <div><strong>Requests:</strong> ${d.count}</div>
          `);
      })
      .on('mousemove', function(event) {
        d3.select('#tooltip')
          .style('left', (event.pageX + 12) + 'px')
          .style('top',  (event.pageY + 12) + 'px');
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', '#4a7fa5');
        d3.select('#tooltip').style('opacity', 0);
      });

    bars.exit().remove();
  }
}
