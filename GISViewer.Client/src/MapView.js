import { MapContainer, TileLayer, GeoJSON, LayersControl, ScaleControl, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import "leaflet-search";

function toUTM10N(lat, lon) {
    const a = 6378137;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e = Math.sqrt(f * (2 - f));
    const zone = 10;
    const lon0 = (zone * 6 - 183) * (Math.PI / 180);
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) ** 2);
    const T = Math.tan(latRad) ** 2;
    const C = (e * e / (1 - e * e)) * Math.cos(latRad) ** 2;
    const A = Math.cos(latRad) * (lonRad - lon0);
    const M =
        a *
        ((1 - e * e / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256) * latRad -
            ((3 * e * e) / 8 + (3 * e ** 4) / 32 + (45 * e ** 6) / 1024) *
            Math.sin(2 * latRad) +
            ((15 * e ** 4) / 256 + (45 * e ** 6) / 1024) * Math.sin(4 * latRad) -
            ((35 * e ** 6) / 3072) * Math.sin(6 * latRad));

    const easting =
        k0 *
        N *
        (A +
            ((1 - T + C) * A ** 3) / 6 +
            ((5 - 18 * T + T ** 2 + 72 * C - 58 * (e * e / (1 - e * e))) *
                A ** 5) /
            120) +
        500000;

    const northing =
        k0 *
        (M +
            N *
            Math.tan(latRad) *
            (A ** 2 / 2 +
                ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
                ((61 - 58 * T + T ** 2 + 600 * C - 330 * (e * e / (1 - e * e))) *
                    A ** 6) /
                720));

    return { easting, northing };
}

function MouseCoordinates() {
    const map = useMap();

    useEffect(() => {
        const coordControl = L.control({ position: "bottomleft" });

        coordControl.onAdd = function () {
            const div = L.DomUtil.create("div", "mouse-coords");
            div.style.background = "rgba(255,255,255,0.9)";
            div.style.padding = "4px 8px";
            div.style.fontSize = "12px";
            div.style.border = "1px solid #ccc";
            div.style.borderRadius = "4px";
            div.style.margin = "10px";
            return div;
        };

        coordControl.addTo(map);

        const div = document.querySelector(".mouse-coords");

        map.on("mousemove", (e) => {
            const { lat, lng } = e.latlng;
            const utm = toUTM10N(lat, lng);
            div.innerHTML =
                `Lat: ${lat.toFixed(3)}, Long: ${lng.toFixed(3)}<br>` +
                `UTM Zone 10N: E: ${utm.easting.toFixed(3)}, N: ${utm.northing.toFixed(3)}`;
        });

        return () => coordControl.remove();
    }, [map]);

    return null;
}

function MouseTooltip() {
    const map = useMap();

    useEffect(() => {
        const tooltip = L.DomUtil.create("div", "mouse-tooltip");
        tooltip.style.position = "absolute";
        tooltip.style.pointerEvents = "none";
        tooltip.style.background = "rgba(255,255,255,0.9)";
        tooltip.style.padding = "3px 6px";
        tooltip.style.border = "1px solid #ccc";
        tooltip.style.borderRadius = "4px";
        tooltip.style.fontSize = "12px";
        tooltip.style.zIndex = "2000";

        map.getContainer().appendChild(tooltip);

        map.on("mousemove", (e) => {
            const { lat, lng } = e.latlng;
            const utm = toUTM10N(lat, lng);

            tooltip.innerHTML =
                `Lat: ${lat.toFixed(3)}, Long: ${lng.toFixed(3)}<br>` +
                `E: ${utm.easting.toFixed(3)}, N: ${utm.northing.toFixed(3)}`;

            const point = map.latLngToContainerPoint(e.latlng);
            tooltip.style.left = point.x + 15 + "px";
            tooltip.style.top = point.y + 15 + "px";
        });

        return () => tooltip.remove();
    }, [map]);

    return null;
}

function UniversalSearch({ facilities, adminBoundaries, waterSupply }) {
    const map = useMap();

    useEffect(() => {
        if (!facilities && !adminBoundaries && !waterSupply) return;

        const allFeatures = [
            ...(facilities?.features || []),
            ...(adminBoundaries?.features || []),
            ...(waterSupply?.features || [])
        ].map(f => ({
            ...f,
            properties: {
                ...f.properties,
                __searchText: Object.values(f.properties).join(" ").toLowerCase()
            }
        }));

        const combinedLayer = L.geoJSON({
            type: "FeatureCollection",
            features: allFeatures
        });

        const container = map.getContainer();
        const div = L.DomUtil.create("div", "custom-search-box", container);

        div.style.position = "absolute";
        div.style.top = "10px";
        div.style.left = "50%";
        div.style.transform = "translateX(-50%)";
        div.style.zIndex = "2000";

        div.innerHTML = `
            <div style="position: relative;">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    style="
                        padding: 6px 12px;
                        border: 1px solid #ccc;
                        border-radius: 6px;
                        width: 360px;
                        font-size: 14px;
                        background: white;
                    "
                />
                <div class="search-results" 
                    style="
                        position: absolute;
                        top: 40px;
                        left: 0;
                        width: 360px;
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 6px;
                        max-height: 240px;
                        overflow-y: auto;
                        display: none;
                        z-index: 9999;
                    ">
                </div>
            </div>
        `;

        const input = div.querySelector("input");
        const resultsBox = div.querySelector(".search-results");

        L.DomEvent.addListener(input, "keyup", function () {
            const query = input.value.toLowerCase();
            resultsBox.innerHTML = "";

            if (!query) {
                resultsBox.style.display = "none";
                return;
            }

            const matches = allFeatures.filter(f =>
                f.properties.__searchText.includes(query)
            ).slice(0, 20);

            if (matches.length === 0) {
                resultsBox.style.display = "none";
                return;
            }

            resultsBox.style.display = "block";

            matches.forEach(match => {
                const item = document.createElement("div");
                item.style.padding = "6px 8px";
                item.style.cursor = "pointer";
                item.style.borderBottom = "1px solid #eee";

                const props = match.properties;

                const label =
                    props.FullName ||
                    props.FULLNAME ||
                    props.fullname ||
                    props.Name ||
                    props.NAME ||
                    props.name ||
                    Object.values(props)[0];

                item.innerHTML = label;

                item.addEventListener("click", () => {
                    const layer = combinedLayer.getLayers().find(
                        l => l.feature === match
                    );

                    if (layer) {
                        if (layer.getBounds) {
                            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
                        } else if (layer.getLatLng) {
                            map.setView(layer.getLatLng(), 16);
                        }
                        layer.openPopup();
                    }

                    resultsBox.style.display = "none";
                    input.value = "";
                });

                resultsBox.appendChild(item);
            });
        });

        return () => {
            if (div && div.parentNode) div.parentNode.removeChild(div);
        };
    }, [map, facilities, adminBoundaries, waterSupply]);

    return null;
}

function MapFooter() {
    const map = useMap();

    useEffect(() => {
        const footer = L.control({ position: "bottomright" });

        footer.onAdd = function () {
            const div = L.DomUtil.create("div", "map-footer");
            div.innerHTML = "Created by Oliver Wackenreuther, 2026 — Sample Purposes Only";
            div.style.background = "rgba(255, 255, 255, 0.9)";
            div.style.padding = "4px 10px";
            div.style.fontSize = "12px";
            div.style.border = "1px solid #ccc";
            div.style.borderRadius = "4px";
            div.style.margin = "10px";
            div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
            return div;
        };

        footer.addTo(map);

        return () => footer.remove();
    }, [map]);

    return null;
}

export default function MapView() {
    const [facilities, setFacilities] = useState(null);
    const [adminBoundaries, setAdminBoundaries] = useState(null);
    const [waterSupply, setWaterSupply] = useState(null);

    useEffect(() => {
        fetch("/data/Public_Solid_Waste_Facilities_-4991589832547784803.geojson")
            .then((res) => res.json())
            .then((data) => setFacilities(data));

        fetch("/data/Administrative_Boundaries_6129341894868586134.geojson")
            .then((res) => res.json())
            .then((data) => setAdminBoundaries(data));

        fetch("/data/Water_Supply_Areas_-9163851906455395793.geojson")
            .then((res) => res.json())
            .then((data) => setWaterSupply(data));
    }, []);

    const pointIcon = new L.Icon({
        iconUrl: "/leaflet/WasteFacilityPin.png",
        shadowUrl: "/leaflet/marker-shadow.png",
        iconSize: [52, 62],
        iconAnchor: [26, 62],
        popupAnchor: [0, -62],
        shadowSize: [50, 50],
        shadowAnchor: [15, 62]
    });

    const pointToLayer = (feature, latlng) => {
        return L.marker(latlng, { icon: pointIcon });
    };

    const buildPopup = (feature) => {
        let html = `
        <table style="
            border-collapse: collapse;
            width: 100%;
            font-size: 13px;
        ">
            <thead>
                <tr>
                    <th style="text-align:left; padding:4px; border-bottom:1px solid #ccc;">Attribute</th>
                    <th style="text-align:left; padding:4px; border-bottom:1px solid #ccc;">Value</th>
                </tr>
            </thead>
            <tbody>
    `;

        for (const key in feature.properties) {
            html += `
            <tr>
                <td style="padding:4px; border-bottom:1px solid #eee;">${key}</td>
                <td style="padding:4px; border-bottom:1px solid #eee;">${feature.properties[key]}</td>
            </tr>
        `;
        }

        html += `
            </tbody>
        </table>
    `;

        return html;
    };


    const highlightStyle = {
        weight: 4,
        color: "#666",
        fillOpacity: 0.3
    };

    const resetStyle = (layer, defaultStyle) => {
        layer.setStyle(defaultStyle);
    };

    const onEachPolygon = (feature, layer, defaultStyle) => {
        layer.bindPopup(buildPopup(feature));

        layer.on("mouseover", () => layer.setStyle(highlightStyle));
        layer.on("mouseout", () => resetStyle(layer, defaultStyle(feature)));

        layer.on("click", () => {
            const bounds = layer.getBounds();
            layer._map.fitBounds(bounds, { padding: [20, 20] });
        });
    };

    const hashString = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
        }
        return hash;
    };

    const adminPalette = [
        "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF",
        "#F4C2C2", "#F7E7CE", "#F6E2B3", "#F3D1BF", "#F9DCC4"
    ];

    const waterPalette = [
        "#c6dbef", "#9ecae1", "#6baed6",
        "#4292c6", "#2171b5", "#08519c", "#08306b"
    ];

    const adminStyle = (feature) => {
        const key = JSON.stringify(feature.properties);
        const hash = hashString(key);
        const color = adminPalette[hash % adminPalette.length];
        return {
            color,
            weight: 3,
            fillOpacity: 0.1
        };
    };

    const waterStyle = (feature) => {
        const key = JSON.stringify(feature.properties);
        const hash = hashString(key);
        const color = waterPalette[hash % waterPalette.length];
        return {
            color,
            weight: 3,
            fillOpacity: 0.5
        };
    };

    return (
        <MapContainer
            center={[49.1, -122.8]}
            zoom={13}
            style={{ height: "100vh", width: "100%" }}
        >
            <MapFooter />
            <ScaleControl position="bottomleft" />

            <MouseCoordinates />
            <MouseTooltip />

            <UniversalSearch
                facilities={facilities}
                adminBoundaries={adminBoundaries}
                waterSupply={waterSupply}
            />

            <LayersControl position="topright" collapsed={false}>

                <LayersControl.BaseLayer checked name="Carto Light">
                    <TileLayer
                        url="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
                        attribution="© CartoDB"
                    />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="Carto Dark">
                    <TileLayer
                        url="https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
                        attribution="© CartoDB"
                    />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="OpenStreetMap">
                    <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="© OpenStreetMap contributors"
                    />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="OpenTopoMap">
                    <TileLayer
                        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                        attribution="© OpenTopoMap contributors"
                    />
                </LayersControl.BaseLayer>

                {adminBoundaries && (
                    <LayersControl.Overlay checked name="Administrative Boundaries">
                        <GeoJSON
                            data={adminBoundaries}
                            style={adminStyle}
                            onEachFeature={(f, l) => onEachPolygon(f, l, adminStyle)}
                        />
                    </LayersControl.Overlay>
                )}

                {waterSupply && (
                    <LayersControl.Overlay checked name="Water Supply Areas">
                        <GeoJSON
                            data={waterSupply}
                            style={waterStyle}
                            onEachFeature={(f, l) => onEachPolygon(f, l, waterStyle)}
                        />
                    </LayersControl.Overlay>
                )}

                {facilities && (
                    <LayersControl.Overlay checked name="Solid Waste Facilities">
                        <GeoJSON
                            data={facilities}
                            pointToLayer={pointToLayer}
                            onEachFeature={(f, l) => l.bindPopup(buildPopup(f))}
                        />
                    </LayersControl.Overlay>
                )}

            </LayersControl>
        </MapContainer>
    );
}
