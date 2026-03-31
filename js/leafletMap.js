class LeafletMap {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
    };

    this.data = _data;
    this.dispatcher = _dispatcher;
    this.mappedData = [];
    this.unmappedData = [];
    this.perceptionRows = [];
    this.perceptionQuestionLabels = [];
    this.selectedPerceptionQuestion = 0;
    this.showPerceptionOverlay = true;
    this.legendItems = [];
    this.selectedLegendKeys = new Set();
    this.selectedDataTypes = new Set(["trash", "construction", "traffic"]);
    this.constructionData = [];
    this.constructionTypeDomain = [];
    this.constructionTypeScale = null;
    this.selectedConstructionTypeKeys = new Set();
    this.ConstructionDots = null;
    this.trafficData = [];
    this.trafficTypeDomain = [];
    this.trafficTypeScale = null;
    this.selectedTrafficTypeKeys = new Set();
    this.TrafficDots = null;
    this.idFilterSet = null;
    this.dayLegendBins = [];
    this.districtPolygons = new Map();
    this.districtCentroids = new Map();
    this.perceptionLayer = L.layerGroup();
    this.perceptionScale = d3.scaleLinear().range(["#d94801", "#fee6ce"]);

    // Default display choices.
    this.colorBy = "serviceType";
    this.currentBasemap = "imagery";

    this.initVis();
  }

  initVis() {
    let vis = this;

    // Split mapped and unmapped calls.
    vis.mappedData = vis.data.filter(
      (d) => !Number.isNaN(d.LATITUDE) && !Number.isNaN(d.LONGITUDE),
    );
    vis.unmappedData = vis.data.filter(
      (d) => Number.isNaN(d.LATITUDE) || Number.isNaN(d.LONGITUDE),
    );

    // Basemap options from the tutorial pattern.
    vis.esriUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    vis.esriAttr =
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

    vis.streetUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    vis.streetAttr = "&copy; OpenStreetMap contributors";

    vis.imageryLayer = L.tileLayer(vis.esriUrl, {
      attribution: vis.esriAttr,
      ext: "png",
    });

    vis.streetLayer = L.tileLayer(vis.streetUrl, {
      attribution: vis.streetAttr,
      maxZoom: 19,
    });

    // Center the map on Cincinnati so the user sees the data right away.
    vis.theMap = L.map("my-map", {
      center: [39.1031, -84.512],
      zoom: 12,
      minZoom: 11,
      maxZoom: 18,
      layers: [vis.imageryLayer],
    });

    vis.perceptionLayer.addTo(vis.theMap);

    // Add the d3 SVG layer on top of Leaflet.
    L.svg({ clickable: true }).addTo(vis.theMap);
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane);
    vis.svg = vis.overlay.select("svg").attr("pointer-events", "auto");

    vis.createScales();

    // Join pattern from the tutorials.
    vis.Dots = vis.svg
      .selectAll("circle")
      .data(vis.mappedData)
      .join("circle")
      .attr("stroke", "#2f2622")
      .attr("stroke-width", 0.8)
      .attr("fill-opacity", 0.85)
      .attr(
        "cx",
        (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
      )
      .attr(
        "cy",
        (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
      )
      .attr("r", 5)
      .attr("fill", (d) => vis.getPointColor(d))
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", 7)
          .attr("stroke-width", 1.4);

        d3.select("#tooltip").style("opacity", 1).html(`
            <div class="tooltip-title">${d.SR_TYPE_DESC || "311 Request"}</div>
            <div><strong>Date created:</strong> ${vis.formatDate(d.DATE_CREATED)}</div>
            <div><strong>Last updated:</strong> ${vis.formatDate(d.DATE_LAST_UPDATE)}</div>
            <div><strong>Agency:</strong> ${d.DEPT_NAME || "Not listed"}</div>
            <div><strong>Priority:</strong> ${d.PRIORITY || "Not listed"}</div>
            <div><strong>Neighborhood:</strong> ${d.NEIGHBORHOOD || "Not listed"}</div>
            <div><strong>Address:</strong> ${d.ADDRESS || "Not listed"}</div>
            <div><strong>Method received:</strong> ${d.METHOD_RECEIVED || "Not listed"}</div>
            <div><strong>Status:</strong> ${d.SR_STATUS || "Not listed"}</div>
            <div><strong>Days to update:</strong> ${vis.formatDays(d.daysToUpdate)}</div>
          `);
      })
      .on("mousemove", function (event) {
        d3.select("#tooltip")
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px");
      })
      .on("mouseleave", function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", 5)
          .attr("stroke-width", 0.8)
          .attr("fill", vis.getPointColor(d));

        d3.select("#tooltip").style("opacity", 0);
      });

    vis.loadConstructionData();
    vis.loadTrafficData();

    // Reposition points after zooming or panning.
    vis.theMap.on("zoomend moveend", function () {
      vis.updateVis();
    });

    // UI controls.
    d3.select("#colorBySelect").on("change", function () {
      vis.colorBy = this.value;
      vis.selectedLegendKeys.clear();
      vis.createScales();
      vis.updateVis();
      vis.updateLegend();
    });

    d3.select("#perceptionQuestionSelect").on("change", function () {
      vis.selectedPerceptionQuestion = +this.value;
      vis.renderPerceptionOverlay();
      vis.updateLegend();
    });

    d3.select("#togglePerceptionBtn").on("click", function () {
      vis.showPerceptionOverlay = !vis.showPerceptionOverlay;
      if (vis.showPerceptionOverlay) {
        vis.renderPerceptionOverlay();
        d3.select(this).text("Hide district shading");
      } else {
        vis.perceptionLayer.clearLayers();
        d3.select(this).text("Show district shading");
      }
      vis.updateLegend();
    });

    d3.select("#toggleBasemapBtn").on("click", function () {
      vis.toggleBasemap();
    });

    vis.updateSummary();
    vis.updateLegend();
    vis.updateVis();
    vis.initPerceptionOverlay();
  }



  initPerceptionOverlay() {
    const vis = this;

    vis.buildDistrictPolygons();

    d3.text("data/trash_service_perceptions.csv").then((text) => {
      const rows = d3.csvParseRows(text.trim());
      if (!rows.length) return;

      const firstKey = String(rows[0][0] || "").trim();
      const firstRowHasNumericValues = rows[0]
        .slice(1)
        .some((v) => Number.isFinite(+v));
      const hasHeaderRow = !(/district/i.test(firstKey) && firstRowHasNumericValues);

      const dataRows = hasHeaderRow ? rows.slice(1) : rows;

      vis.perceptionQuestionLabels = hasHeaderRow
        ? rows[0]
          .slice(1)
          .map((label, i) => String(label || "").trim() || `Question ${i + 1}`)
        : d3
          .range(Math.max((rows[0]?.length || 1) - 1, 0))
          .map((i) => `Question ${i + 1}`);

      vis.perceptionRows = dataRows
        .filter((row) => row.length >= 2)
        .map((row) => {
          const districtLabel = (row[0] || "").trim();
          const districtNum = districtLabel.replace(/[^0-9]/g, "");
          const values = row.slice(1).map((v) => +v);
          return { districtLabel, districtNum, values };
        });

      if (!vis.perceptionRows.length) return;

      const questionSelect = d3.select("#perceptionQuestionSelect");
      questionSelect
        .selectAll("option")
        .data(vis.perceptionQuestionLabels)
        .join("option")
        .attr("value", (_, i) => i)
        .text((d) => d);

      questionSelect.property("value", 0);
      vis.selectedPerceptionQuestion = 0;
      vis.renderPerceptionOverlay();
      vis.updateLegend();
    });
  }

  buildDistrictPolygons() {
    const vis = this;
    const grouped = d3.group(
      vis.mappedData.filter((d) => String(d.POLICE_DISTRICT || "").trim()),
      (d) => String(d.POLICE_DISTRICT).trim(),
    );

    grouped.forEach((rows, districtNum) => {
      const points = rows.map((d) => [+d.LONGITUDE, +d.LATITUDE]);
      const latAvg = d3.mean(rows, (d) => +d.LATITUDE);
      const lonAvg = d3.mean(rows, (d) => +d.LONGITUDE);
      if (Number.isFinite(latAvg) && Number.isFinite(lonAvg)) {
        vis.districtCentroids.set(districtNum, [latAvg, lonAvg]);
      }

      const hull = d3.polygonHull(points);
      if (!hull || hull.length < 3) return;

      const latLngHull = hull.map(([lon, lat]) => [lat, lon]);
      vis.districtPolygons.set(districtNum, latLngHull);
    });
  }

  renderPerceptionOverlay() {
    const vis = this;
    vis.perceptionLayer.clearLayers();

    if (!vis.perceptionRows.length || !vis.showPerceptionOverlay) return;

    const values = vis.perceptionRows
      .map((d) => d.values[vis.selectedPerceptionQuestion])
      .filter((v) => Number.isFinite(v));

    if (!values.length) return;

    vis.perceptionScale.domain(d3.extent(values));

    vis.perceptionRows.forEach((row) => {
      const value = row.values[vis.selectedPerceptionQuestion];
      if (!Number.isFinite(value)) return;

      const polygon = vis.districtPolygons.get(row.districtNum);
      const fillColor = vis.perceptionScale(value);

      let layer;
      if (polygon) {
        layer = L.polygon(polygon, {
          color: "#8c2d04",
          weight: 2,
          fillColor,
          fillOpacity: 0.62,
          interactive: true,
        });
      } else {
        const centroid = vis.districtCentroids.get(row.districtNum);
        if (!centroid) return;

        layer = L.circleMarker(centroid, {
          radius: 16,
          color: "#8c2d04",
          weight: 2,
          fillColor,
          fillOpacity: 0.8,
          interactive: true,
        });
      }

      layer.bindTooltip(
        `<strong>${row.districtLabel}</strong><br>${vis.perceptionQuestionLabels[vis.selectedPerceptionQuestion]}: ${value.toFixed(2)}`,
        { sticky: true },
      );

      vis.perceptionLayer.addLayer(layer);
    });

    vis.perceptionLayer.eachLayer((layer) => {
      if (layer.bringToFront) layer.bringToFront();
    });
  }

  createScales() {
    let vis = this;

    // Sequential color scale for time between created date and last update.
    const validDays = vis.mappedData
      .map((d) => d.daysToUpdate)
      .filter((d) => d != null && !Number.isNaN(d));

    const daysExtent = d3.extent(validDays);
    vis.timeScale = d3
      .scaleLinear()
      .domain(daysExtent)
      .range(["#0e2f4e", "#cfe8f3"]);

    // Categorical scales for the nominal fields.
    vis.neighborhoodDomain = Array.from(
      new Set(vis.mappedData.map((d) => d.NEIGHBORHOOD).filter(Boolean)),
    ).sort();
    vis.priorityDomain = Array.from(
      new Set(vis.mappedData.map((d) => d.PRIORITY).filter(Boolean)),
    ).sort();
    vis.departmentDomain = Array.from(
      new Set(vis.mappedData.map((d) => d.DEPT_NAME).filter(Boolean)),
    ).sort();
    vis.serviceTypeDomain = Array.from(
      new Set(vis.mappedData.map((d) => d.SR_TYPE_DESC).filter(Boolean)),
    ).sort();

    const blueCount = Math.max(vis.serviceTypeDomain.length, 1);
    const blueRange = d3.quantize(
      d3.interpolateRgbBasis(["#deebf7", "#6baed6", "#2171b5", "#08306b"]),
      blueCount,
    );
    vis.serviceTypeScale = d3
      .scaleOrdinal()
      .domain(vis.serviceTypeDomain)
      .range(blueRange);

    vis.neighborhoodScale = d3
      .scaleOrdinal()
      .domain(vis.neighborhoodDomain)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

    vis.priorityScale = d3
      .scaleOrdinal()
      .domain(vis.priorityDomain)
      .range(d3.schemeSet2);

    vis.departmentScale = d3
      .scaleOrdinal()
      .domain(vis.departmentDomain)
      .range(d3.schemeSet2.concat(d3.schemeTableau10));
  }

  getPointColor(d) {
    let vis = this;

    if (vis.colorBy === "daysToUpdate") {
      return d.daysToUpdate == null ? "#807675" : vis.timeScale(d.daysToUpdate);
    }

    if (vis.colorBy === "neighborhood") {
      return d.NEIGHBORHOOD ? vis.neighborhoodScale(d.NEIGHBORHOOD) : "#807675";
    }

    if (vis.colorBy === "priority") {
      return d.PRIORITY ? vis.priorityScale(d.PRIORITY) : "#807675";
    }

    if (vis.colorBy === "department") {
      return d.DEPT_NAME ? vis.departmentScale(d.DEPT_NAME) : "#807675";
    }

    if (vis.colorBy === "serviceType") {
      return d.SR_TYPE_DESC ? vis.serviceTypeScale(d.SR_TYPE_DESC) : "#807675";
    }

    return "#0e2f4e";
  }

  updateVis() {
    let vis = this;

    vis.Dots.attr(
      "cx",
      (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
    )
      .attr(
        "cy",
        (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
      )
      .attr("fill", (d) => vis.getPointColor(d))
      .attr("r", function () {
        return +d3.select(this).attr("r") === 7 ? 7 : 5;
      });

    if (vis.ConstructionDots) {
      vis.ConstructionDots
        .attr(
          "cx",
          (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
        )
        .attr(
          "cy",
          (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
        );
    }

    if (vis.TrafficDots) {
      vis.TrafficDots
        .attr(
          "cx",
          (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
        )
        .attr(
          "cy",
          (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
        );
    }

    vis.applyCombinedFilters();
  }

  loadConstructionData() {
    const vis = this;

    d3.csv("data/311_Construction_processed.csv")
      .then((rows) => {
        rows.forEach((d) => {
          d.LATITUDE = +d.LATITUDE;
          d.LONGITUDE = +d.LONGITUDE;
        });

        vis.constructionData = rows.filter(
          (d) => Number.isFinite(d.LATITUDE) && Number.isFinite(d.LONGITUDE),
        );

        vis.constructionTypeDomain = Array.from(
          new Set(vis.constructionData.map((d) => d.SR_TYPE_DESC).filter(Boolean)),
        ).sort();

        const purpleCount = Math.max(vis.constructionTypeDomain.length, 1);
        const purpleRange = d3.quantize(
          d3.interpolateRgbBasis(["#f2e5ff", "#c8a8ef", "#9b6fd3", "#6f42c1", "#4c1d95"]),
          purpleCount,
        );
        vis.constructionTypeScale = d3
          .scaleOrdinal()
          .domain(vis.constructionTypeDomain)
          .range(purpleRange);

        if (!vis.selectedConstructionTypeKeys.size) {
          vis.selectedConstructionTypeKeys = new Set(vis.constructionTypeDomain);
        }

        vis.ConstructionDots = vis.svg
          .selectAll(".construction-dot")
          .data(vis.constructionData, (d) => d.SR_NUMBER || `${d.LATITUDE}-${d.LONGITUDE}`)
          .join("circle")
          .attr("class", "construction-dot")
          .attr("stroke", "#6e5a00")
          .attr("stroke-width", 0.9)
          .attr("fill", (d) => {
            const key = d.SR_TYPE_DESC || "__construction_missing__";
            return key === "__construction_missing__"
              ? "#b39ddb"
              : vis.constructionTypeScale(d.SR_TYPE_DESC);
          })
          .attr("fill-opacity", 0.85)
          .attr(
            "cx",
            (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
          )
          .attr(
            "cy",
            (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
          )
          .attr("r", 5)
          .on("mouseover", function (event, d) {
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", 7)
              .attr("stroke-width", 1.4);

            d3.select("#tooltip").style("opacity", 1).html(`
              <div class="tooltip-title">${d.SR_TYPE_DESC || "311 Construction"}</div>
              <div><strong>Date created:</strong> ${vis.formatDate(d.DATE_CREATED)}</div>
              <div><strong>Agency:</strong> ${d.DEPT_NAME || "Not listed"}</div>
              <div><strong>Priority:</strong> ${d.PRIORITY || "Not listed"}</div>
              <div><strong>Neighborhood:</strong> ${d.NEIGHBORHOOD || "Not listed"}</div>
              <div><strong>Address:</strong> ${d.ADDRESS || "Not listed"}</div>
              <div><strong>Status:</strong> ${d.SR_STATUS || "Not listed"}</div>
            `);
          })
          .on("mousemove", function (event) {
            d3.select("#tooltip")
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY + 12 + "px");
          })
          .on("mouseleave", function () {
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", 5)
              .attr("stroke-width", 0.9);

            d3.select("#tooltip").style("opacity", 0);
          });

        vis.applyCombinedFilters();
        vis.updateLegend();
      })
      .catch(() => {
        vis.constructionData = [];
      });
  }

  loadTrafficData() {
    const vis = this;

    d3.csv("data/311_Traffic_processed.csv")
      .then((rows) => {
        rows.forEach((d) => {
          d.LATITUDE = +d.LATITUDE;
          d.LONGITUDE = +d.LONGITUDE;
        });

        vis.trafficData = rows.filter(
          (d) => Number.isFinite(d.LATITUDE) && Number.isFinite(d.LONGITUDE),
        );

        vis.trafficTypeDomain = Array.from(
          new Set(vis.trafficData.map((d) => d.SR_TYPE_DESC).filter(Boolean)),
        ).sort();

        const redCount = Math.max(vis.trafficTypeDomain.length, 1);
        const redRange = d3.quantize(
          d3.interpolateRgbBasis(["#fee5e5", "#fca5a5", "#ef4444", "#b91c1c", "#7f1d1d"]),
          redCount,
        );
        vis.trafficTypeScale = d3
          .scaleOrdinal()
          .domain(vis.trafficTypeDomain)
          .range(redRange);

        if (!vis.selectedTrafficTypeKeys.size) {
          vis.selectedTrafficTypeKeys = new Set(vis.trafficTypeDomain);
        }

        vis.TrafficDots = vis.svg
          .selectAll(".traffic-dot")
          .data(vis.trafficData, (d) => d.SR_NUMBER || `${d.LATITUDE}-${d.LONGITUDE}`)
          .join("circle")
          .attr("class", "traffic-dot")
          .attr("stroke", "#5f1111")
          .attr("stroke-width", 0.9)
          .attr("fill", (d) => {
            const key = d.SR_TYPE_DESC || "__traffic_missing__";
            return key === "__traffic_missing__"
              ? "#dca3a3"
              : vis.trafficTypeScale(d.SR_TYPE_DESC);
          })
          .attr("fill-opacity", 0.85)
          .attr(
            "cx",
            (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).x,
          )
          .attr(
            "cy",
            (d) => vis.theMap.latLngToLayerPoint([d.LATITUDE, d.LONGITUDE]).y,
          )
          .attr("r", 5)
          .on("mouseover", function (event, d) {
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", 7)
              .attr("stroke-width", 1.4);

            d3.select("#tooltip").style("opacity", 1).html(`
              <div class="tooltip-title">${d.SR_TYPE_DESC || "311 Traffic"}</div>
              <div><strong>Date created:</strong> ${vis.formatDate(d.DATE_CREATED)}</div>
              <div><strong>Agency:</strong> ${d.DEPT_NAME || "Not listed"}</div>
              <div><strong>Priority:</strong> ${d.PRIORITY || "Not listed"}</div>
              <div><strong>Neighborhood:</strong> ${d.NEIGHBORHOOD || "Not listed"}</div>
              <div><strong>Address:</strong> ${d.ADDRESS || "Not listed"}</div>
              <div><strong>Status:</strong> ${d.SR_STATUS || "Not listed"}</div>
            `);
          })
          .on("mousemove", function (event) {
            d3.select("#tooltip")
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY + 12 + "px");
          })
          .on("mouseleave", function () {
            d3.select(this)
              .transition()
              .duration(150)
              .attr("r", 5)
              .attr("stroke-width", 0.9);

            d3.select("#tooltip").style("opacity", 0);
          });

        vis.applyCombinedFilters();
        vis.updateLegend();
      })
      .catch(() => {
        vis.trafficData = [];
      });
  }
  updateSummary() {
    let vis = this;

    d3.select("#mappedCount").text(vis.mappedData.length);
    d3.select("#unmappedCount").text(vis.unmappedData.length);
    d3.select("#serviceTypeLabel").text("All service requests");
    d3.select("#basemapLabel").text(
      vis.currentBasemap === "imagery" ? "Imagery" : "Street map",
    );
  }

  updateLegend() {
    let vis = this;
    const legend = d3.select("#legend");
    legend.selectAll("*").remove();

    vis.legendItems = vis.getLegendItems();

    if (!vis.legendItems.length) {
      d3.select("#legendTitle").text("Legend");
      return;
    }

    const validKeys = new Set(vis.legendItems.map((item) => item.key));
    const persistedKeys = Array.from(vis.selectedLegendKeys).filter((key) =>
      validKeys.has(key),
    );

    if (!persistedKeys.length) {
      vis.selectedLegendKeys = new Set(vis.legendItems.map((item) => item.key));
    } else {
      vis.selectedLegendKeys = new Set(persistedKeys);
    }

    d3.select("#legendTitle").text(vis.getLegendTitle());

    legend
      .append("div")
      .attr("class", "legend-note")
      .text("Toggle categories to filter map points");

    legend
      .append("div")
      .attr("class", "legend-row")
      .html("<strong>Request source</strong>");

    const sourceRows = legend
      .append("div")
      .attr("class", "legend-list")
      .selectAll("label")
      .data([
        { key: "trash", label: "Trash requests", color: "#2171b5" },
        { key: "construction", label: "Construction requests", color: "#783a9f" },
        { key: "traffic", label: "Traffic requests", color: "#ef4444" },
      ])
      .join("label")
      .attr("class", "legend-row legend-toggle");

    sourceRows
      .append("input")
      .attr("type", "checkbox")
      .attr("class", "legend-checkbox")
      .property("checked", (d) => vis.selectedDataTypes.has(d.key))
      .on("change", function (_, d) {
        if (this.checked) {
          vis.selectedDataTypes.add(d.key);
        } else {
          vis.selectedDataTypes.delete(d.key);
        }
        vis.applyCombinedFilters();
      });

    sourceRows
      .append("span")
      .attr("class", "legend-swatch")
      .style("background", (d) => d.color);

    sourceRows.append("span").text((d) => d.label);

    if (vis.constructionTypeDomain.length) {
      legend
        .append("div")
        .attr("class", "legend-row")
        .style("margin-top", "4px")
        .html("<strong>Construction SR type</strong>");

      const constructionItems = vis.constructionTypeDomain
        .map((value) => ({
          key: value,
          label: value,
          color: vis.constructionTypeScale(value),
        }));

      const cRows = legend
        .append("div")
        .attr("class", "legend-list")
        .selectAll("label")
        .data(constructionItems, (d) => d.key)
        .join("label")
        .attr("class", "legend-row legend-toggle");

      cRows
        .append("input")
        .attr("type", "checkbox")
        .attr("class", "legend-checkbox")
        .property("checked", (d) => vis.selectedConstructionTypeKeys.has(d.key))
        .on("change", function (_, d) {
          if (this.checked) {
            vis.selectedConstructionTypeKeys.add(d.key);
          } else {
            vis.selectedConstructionTypeKeys.delete(d.key);
          }
          vis.applyCombinedFilters();
        });

      cRows
        .append("span")
        .attr("class", "legend-swatch")
        .style("background", (d) => d.color);

      cRows.append("span").text((d) => d.label);
    }

    if (vis.trafficTypeDomain.length) {
      legend
        .append("div")
        .attr("class", "legend-row")
        .style("margin-top", "4px")
        .html("<strong>Traffic SR type</strong>");

      const trafficItems = vis.trafficTypeDomain
        .map((value) => ({
          key: value,
          label: value,
          color: vis.trafficTypeScale(value),
        }));

      const tRows = legend
        .append("div")
        .attr("class", "legend-list")
        .selectAll("label")
        .data(trafficItems, (d) => d.key)
        .join("label")
        .attr("class", "legend-row legend-toggle");

      tRows
        .append("input")
        .attr("type", "checkbox")
        .attr("class", "legend-checkbox")
        .property("checked", (d) => vis.selectedTrafficTypeKeys.has(d.key))
        .on("change", function (_, d) {
          if (this.checked) {
            vis.selectedTrafficTypeKeys.add(d.key);
          } else {
            vis.selectedTrafficTypeKeys.delete(d.key);
          }
          vis.applyCombinedFilters();
        });

      tRows
        .append("span")
        .attr("class", "legend-swatch")
        .style("background", (d) => d.color);

      tRows.append("span").text((d) => d.label);
    }

    legend
      .append("div")
      .attr("class", "legend-row")
      .style("margin-top", "4px")
      .html("<strong>Trash categories</strong>");

    const rows = legend
      .append("div")
      .attr("class", "legend-list")
      .selectAll("label")
      .data(vis.legendItems, (d) => d.key)
      .join("label")
      .attr("class", "legend-row legend-toggle");

    rows
      .append("input")
      .attr("type", "checkbox")
      .attr("class", "legend-checkbox")
      .property("checked", (d) => vis.selectedLegendKeys.has(d.key))
      .on("change", function (_, d) {
        if (this.checked) {
          vis.selectedLegendKeys.add(d.key);
        } else {
          vis.selectedLegendKeys.delete(d.key);
        }
        vis.applyCombinedFilters();
      });

    rows
      .append("span")
      .attr("class", "legend-swatch")
      .style("background", (d) => d.color);

    rows.append("span").text((d) => d.label);

    if (
      vis.showPerceptionOverlay &&
      vis.perceptionRows.length &&
      vis.perceptionQuestionLabels.length
    ) {
      const pValues = vis.perceptionRows
        .map((d) => d.values[vis.selectedPerceptionQuestion])
        .filter((v) => Number.isFinite(v));

      if (pValues.length) {
        vis.perceptionScale.domain(d3.extent(pValues));

        legend
          .append("div")
          .attr("class", "legend-row")
          .style("margin-top", "6px")
          .html(
            `<strong>District perceptions (${vis.perceptionQuestionLabels[vis.selectedPerceptionQuestion]})</strong>`,
          );

        legend
          .append("div")
          .attr("class", "legend-gradient")
          .style(
            "background",
            `linear-gradient(to right, ${vis.perceptionScale.range()[0]}, ${vis.perceptionScale.range()[1]})`,
          );

        legend
          .append("div")
          .attr("class", "legend-scale")
          .html(
            `<span>${d3.min(pValues).toFixed(2)}</span><span>${d3.max(pValues).toFixed(2)}</span>`,
          );
      }
    }

    vis.applyCombinedFilters();
  }

  getLegendTitle() {
    const vis = this;
    if (vis.colorBy === "daysToUpdate") {
      return "Legend: Days from created date to last update";
    }
    if (vis.colorBy === "neighborhood") {
      return "Legend: Neighborhood";
    }
    if (vis.colorBy === "priority") {
      return "Legend: Priority";
    }
    if (vis.colorBy === "department") {
      return "Legend: Public agency";
    }
    if (vis.colorBy === "serviceType") {
      return "Legend: Service type";
    }
    return "Legend";
  }

  getLegendItems() {
    const vis = this;

    if (vis.colorBy === "daysToUpdate") {
      const [rawMin, rawMax] = vis.timeScale.domain();
      const minDays = Number.isFinite(rawMin) ? rawMin : 0;
      const maxDays = Number.isFinite(rawMax) ? rawMax : minDays;
      const binCount = 5;

      vis.dayLegendBins = [];

      if (maxDays === minDays) {
        vis.dayLegendBins.push({
          key: "days-bin-0",
          min: minDays,
          max: maxDays,
          label: `${minDays.toFixed(1)} days`,
          color: vis.timeScale(minDays),
        });
      } else {
        const step = (maxDays - minDays) / binCount;

        for (let i = 0; i < binCount; i += 1) {
          const start = minDays + i * step;
          const end = i === binCount - 1 ? maxDays : minDays + (i + 1) * step;
          const midpoint = (start + end) / 2;

          vis.dayLegendBins.push({
            key: `days-bin-${i}`,
            min: start,
            max: end,
            label: `${start.toFixed(1)} to ${end.toFixed(1)} days`,
            color: vis.timeScale(midpoint),
          });
        }
      }

      return vis.dayLegendBins
        .map((bin) => ({ key: bin.key, label: bin.label, color: bin.color }));
    }

    let domain = [];
    let scale = null;

    if (vis.colorBy === "neighborhood") {
      domain = vis.neighborhoodDomain;
      scale = vis.neighborhoodScale;
    } else if (vis.colorBy === "priority") {
      domain = vis.priorityDomain;
      scale = vis.priorityScale;
    } else if (vis.colorBy === "department") {
      domain = vis.departmentDomain;
      scale = vis.departmentScale;
    } else if (vis.colorBy === "serviceType") {
      domain = vis.serviceTypeDomain;
      scale = vis.serviceTypeScale;
    }

    return domain
      .map((value) => ({ key: value, label: value, color: scale(value) }));
  }

  getLegendKey(d) {
    const vis = this;

    if (vis.colorBy === "daysToUpdate") {
      if (d.daysToUpdate == null || Number.isNaN(d.daysToUpdate)) {
        return "__missing__";
      }

      const match = vis.dayLegendBins.find(
        (bin, index) =>
          d.daysToUpdate >= bin.min &&
          (index === vis.dayLegendBins.length - 1
            ? d.daysToUpdate <= bin.max
            : d.daysToUpdate < bin.max),
      );

      return match ? match.key : "__missing__";
    }

    if (vis.colorBy === "neighborhood") {
      return d.NEIGHBORHOOD || "__missing__";
    }

    if (vis.colorBy === "priority") {
      return d.PRIORITY || "__missing__";
    }

    if (vis.colorBy === "department") {
      return d.DEPT_NAME || "__missing__";
    }

    if (vis.colorBy === "serviceType") {
      return d.SR_TYPE_DESC || "__missing__";
    }

    return "__missing__";
  }

  applyCombinedFilters() {
    const vis = this;

    vis.Dots
      .attr("fill-opacity", (d) => {
        const inIdSelection = !vis.idFilterSet || vis.idFilterSet.has(d.SR_NUMBER);
        const inSourceSelection = vis.selectedDataTypes.has("trash");
        const legendKey = vis.getLegendKey(d);
        const inLegendSelection =
          legendKey === "__missing__" || vis.selectedLegendKeys.has(legendKey);
        return inIdSelection && inSourceSelection && inLegendSelection ? 0.85 : 0.08;
      })
      .attr("stroke-opacity", (d) => {
        const inIdSelection = !vis.idFilterSet || vis.idFilterSet.has(d.SR_NUMBER);
        const inSourceSelection = vis.selectedDataTypes.has("trash");
        const legendKey = vis.getLegendKey(d);
        const inLegendSelection =
          legendKey === "__missing__" || vis.selectedLegendKeys.has(legendKey);
        return inIdSelection && inSourceSelection && inLegendSelection ? 1 : 0.08;
      });

    if (vis.ConstructionDots) {
      const showConstruction = vis.selectedDataTypes.has("construction");
      vis.ConstructionDots
        .attr("fill-opacity", (d) => {
          const typeKey = d.SR_TYPE_DESC || "__construction_missing__";
          const typeSelected =
            typeKey === "__construction_missing__" ||
            vis.selectedConstructionTypeKeys.has(typeKey);
          return showConstruction && typeSelected ? 0.85 : 0.08;
        })
        .attr("stroke-opacity", (d) => {
          const typeKey = d.SR_TYPE_DESC || "__construction_missing__";
          const typeSelected =
            typeKey === "__construction_missing__" ||
            vis.selectedConstructionTypeKeys.has(typeKey);
          return showConstruction && typeSelected ? 1 : 0.08;
        });
    }

    if (vis.TrafficDots) {
      const showTraffic = vis.selectedDataTypes.has("traffic");
      vis.TrafficDots
        .attr("fill-opacity", (d) => {
          const typeKey = d.SR_TYPE_DESC || "__traffic_missing__";
          const typeSelected =
            typeKey === "__traffic_missing__" ||
            vis.selectedTrafficTypeKeys.has(typeKey);
          return showTraffic && typeSelected ? 0.85 : 0.08;
        })
        .attr("stroke-opacity", (d) => {
          const typeKey = d.SR_TYPE_DESC || "__traffic_missing__";
          const typeSelected =
            typeKey === "__traffic_missing__" ||
            vis.selectedTrafficTypeKeys.has(typeKey);
          return showTraffic && typeSelected ? 1 : 0.08;
        });
    }
  }

  toggleBasemap() {
    let vis = this;

    if (vis.currentBasemap === "imagery") {
      vis.theMap.removeLayer(vis.imageryLayer);
      vis.streetLayer.addTo(vis.theMap);
      vis.currentBasemap = "streets";
    } else {
      vis.theMap.removeLayer(vis.streetLayer);
      vis.imageryLayer.addTo(vis.theMap);
      vis.currentBasemap = "imagery";
    }

    vis.updateSummary();
  }

  formatDate(value) {
    if (!value) return "Not listed";
    return value;
  }

  formatDays(value) {
    if (value == null || Number.isNaN(value)) return "Not available";
    return value.toFixed(1) + " days";
  }

  filterByIds(idSet) {
    this.idFilterSet = idSet;
    this.applyCombinedFilters();
  }

}

