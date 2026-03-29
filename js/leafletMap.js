class LeafletMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement
    };

    this.data = _data;
    this.mappedData = [];
    this.unmappedData = [];

    // Default display choices.
    this.colorBy = 'daysToUpdate';
    this.currentBasemap = 'imagery';

    this.initVis();
  }

  initVis() {
    let vis = this;

    // Split mapped and unmapped calls.
    vis.mappedData = vis.data.filter(d => !Number.isNaN(d.LATITUDE) && !Number.isNaN(d.LONGITUDE));
    vis.unmappedData = vis.data.filter(d => Number.isNaN(d.LATITUDE) || Number.isNaN(d.LONGITUDE));

    // Basemap options from the tutorial pattern.
    vis.esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    vis.esriAttr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    vis.streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    vis.streetAttr = '&copy; OpenStreetMap contributors';

    vis.imageryLayer = L.tileLayer(vis.esriUrl, {
      attribution: vis.esriAttr,
      ext: 'png'
    });

    vis.streetLayer = L.tileLayer(vis.streetUrl, {
      attribution: vis.streetAttr,
      maxZoom: 19
    });

    // Center the map on Cincinnati so the user sees the data right away.
    vis.theMap = L.map('my-map', {
      center: [39.1031, -84.5120],
      zoom: 12,
      minZoom: 11,
      maxZoom: 18,
      layers: [vis.imageryLayer]
    });

    // Add the d3 SVG layer on top of Leaflet.
    L.svg({ clickable: true }).addTo(vis.theMap);
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');

    vis.createScales();

    // Join pattern from the tutorials.
    vis.Dots = vis.svg.selectAll('circle')
      .data(vis.mappedData)
      .join('circle')
      .attr('stroke', '#2f2622')
      .attr('stroke-width', 0.8)
      .attr('fill-opacity', 0.85)
      .attr('cx', d => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x)
      .attr('cy', d => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y)
      .attr('r', 5)
      .attr('fill', d => vis.getPointColor(d))
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 7)
          .attr('stroke-width', 1.4);

        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <div class="tooltip-title">${d.SR_TYPE_DESC || '311 Request'}</div>
            <div><strong>Date created:</strong> ${vis.formatDate(d.DATE_CREATED)}</div>
            <div><strong>Last updated:</strong> ${vis.formatDate(d.DATE_LAST_UPDATE)}</div>
            <div><strong>Agency:</strong> ${d.DEPT_NAME || 'Not listed'}</div>
            <div><strong>Priority:</strong> ${d.PRIORITY || 'Not listed'}</div>
            <div><strong>Neighborhood:</strong> ${d.NEIGHBORHOOD || 'Not listed'}</div>
            <div><strong>Address:</strong> ${d.ADDRESS || 'Not listed'}</div>
            <div><strong>Method received:</strong> ${d.METHOD_RECEIVED || 'Not listed'}</div>
            <div><strong>Status:</strong> ${d.SR_STATUS || 'Not listed'}</div>
            <div><strong>Days to update:</strong> ${vis.formatDays(d.daysToUpdate)}</div>
          `);
      })
      .on('mousemove', function(event) {
        d3.select('#tooltip')
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY + 12) + 'px');
      })
      .on('mouseleave', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 5)
          .attr('stroke-width', 0.8)
          .attr('fill', vis.getPointColor(d));

        d3.select('#tooltip').style('opacity', 0);
      });

    // Reposition points after zooming or panning.
    vis.theMap.on('zoomend moveend', function() {
      vis.updateVis();
    });

    // UI controls.
    d3.select('#colorBySelect').on('change', function() {
      vis.colorBy = this.value;
      vis.createScales();
      vis.updateVis();
      vis.updateLegend();
    });

    d3.select('#toggleBasemapBtn').on('click', function() {
      vis.toggleBasemap();
    });

    vis.updateSummary();
    vis.updateLegend();
    vis.updateVis();
  }

  createScales() {
    let vis = this;

    // Sequential color scale for time between created date and last update.
    const validDays = vis.mappedData
      .map(d => d.daysToUpdate)
      .filter(d => d != null && !Number.isNaN(d));

    const daysExtent = d3.extent(validDays);
    vis.timeScale = d3.scaleLinear()
      .domain(daysExtent)
      .range(['#cfe8f3', '#0e2f4e']);

    // Categorical scales for the nominal fields.
    vis.neighborhoodDomain = Array.from(new Set(vis.mappedData.map(d => d.NEIGHBORHOOD).filter(Boolean))).sort();
    vis.priorityDomain = Array.from(new Set(vis.mappedData.map(d => d.PRIORITY).filter(Boolean))).sort();
    vis.departmentDomain = Array.from(new Set(vis.mappedData.map(d => d.DEPT_NAME).filter(Boolean))).sort();

    vis.neighborhoodScale = d3.scaleOrdinal()
      .domain(vis.neighborhoodDomain)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

    vis.priorityScale = d3.scaleOrdinal()
      .domain(vis.priorityDomain)
      .range(d3.schemeSet2);

    vis.departmentScale = d3.scaleOrdinal()
      .domain(vis.departmentDomain)
      .range(d3.schemeSet2.concat(d3.schemeTableau10));
  }

  getPointColor(d) {
    let vis = this;

    if (vis.colorBy === 'daysToUpdate') {
      return d.daysToUpdate == null ? '#807675' : vis.timeScale(d.daysToUpdate);
    }

    if (vis.colorBy === 'neighborhood') {
      return d.NEIGHBORHOOD ? vis.neighborhoodScale(d.NEIGHBORHOOD) : '#807675';
    }

    if (vis.colorBy === 'priority') {
      return d.PRIORITY ? vis.priorityScale(d.PRIORITY) : '#807675';
    }

    if (vis.colorBy === 'department') {
      return d.DEPT_NAME ? vis.departmentScale(d.DEPT_NAME) : '#807675';
    }

    return '#0e2f4e';
  }

  updateVis() {
    let vis = this;

    vis.Dots
      .attr('cx', d => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x)
      .attr('cy', d => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y)
      .attr('fill', d => vis.getPointColor(d))
      .attr('r', 5);
  }

  updateSummary() {
    let vis = this;

    d3.select('#mappedCount').text(vis.mappedData.length);
    d3.select('#unmappedCount').text(vis.unmappedData.length);
    d3.select('#serviceTypeLabel').text('Trash-related requests');
    d3.select('#basemapLabel').text(vis.currentBasemap === 'imagery' ? 'Imagery' : 'Street map');
  }

  updateLegend() {
    let vis = this;
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();

    if (vis.colorBy === 'daysToUpdate') {
      d3.select('#legendTitle').text('Legend: Days from created date to last update');

      legend.append('div')
        .attr('class', 'legend-gradient')
        .style('background', 'linear-gradient(to right, #cfe8f3, #0e2f4e)');

      const [minDays, maxDays] = vis.timeScale.domain();
      legend.append('div')
        .attr('class', 'legend-scale')
        .html(`<span>${vis.formatDays(minDays)}</span><span>${vis.formatDays(maxDays)}</span>`);

      legend.append('div')
        .attr('class', 'legend-row')
        .html('<span class="legend-swatch" style="background:#807675"></span><span>Missing date information</span>');

      return;
    }

    let domain = [];
    let scale = null;
    let title = 'Legend';

    if (vis.colorBy === 'neighborhood') {
      domain = vis.neighborhoodDomain;
      scale = vis.neighborhoodScale;
      title = 'Legend: Neighborhood';
    } else if (vis.colorBy === 'priority') {
      domain = vis.priorityDomain;
      scale = vis.priorityScale;
      title = 'Legend: Priority';
    } else if (vis.colorBy === 'department') {
      domain = vis.departmentDomain;
      scale = vis.departmentScale;
      title = 'Legend: Public agency';
    }

    d3.select('#legendTitle').text(title);

    // Keep the legend readable by showing the first several categories.
    domain.slice(0, 12).forEach(value => {
      legend.append('div')
        .attr('class', 'legend-row')
        .html(`<span class="legend-swatch" style="background:${scale(value)}"></span><span>${value}</span>`);
    });

    if (domain.length > 12) {
      legend.append('div')
        .attr('class', 'legend-row')
        .text(`+ ${domain.length - 12} more categories on the map`);
    }

    legend.append('div')
      .attr('class', 'legend-row')
      .html('<span class="legend-swatch" style="background:#807675"></span><span>Missing value</span>');
  }

  toggleBasemap() {
    let vis = this;

    if (vis.currentBasemap === 'imagery') {
      vis.theMap.removeLayer(vis.imageryLayer);
      vis.streetLayer.addTo(vis.theMap);
      vis.currentBasemap = 'streets';
    } else {
      vis.theMap.removeLayer(vis.streetLayer);
      vis.imageryLayer.addTo(vis.theMap);
      vis.currentBasemap = 'imagery';
    }

    vis.updateSummary();
  }

  formatDate(value) {
    if (!value) return 'Not listed';
    return value;
  }

  formatDays(value) {
    if (value == null || Number.isNaN(value)) return 'Not available';
    return value.toFixed(1) + ' days';
  }
}
