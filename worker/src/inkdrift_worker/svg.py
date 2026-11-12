import re
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
MAX_SVG_BYTES = 4 * 1024 * 1024

ALLOWED_ELEMENTS = {
    "svg",
    "g",
    "defs",
    "symbol",
    "use",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "textPath",
    "title",
    "desc",
    "style",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "mask",
    "pattern",
    "marker",
    "filter",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
}

ALLOWED_ATTRIBUTES = {
    "id",
    "class",
    "transform",
    "viewBox",
    "preserveAspectRatio",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "pathLength",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
    "color",
    "display",
    "visibility",
    "overflow",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "font-stretch",
    "font-variant",
    "letter-spacing",
    "word-spacing",
    "text-anchor",
    "text-decoration",
    "dominant-baseline",
    "alignment-baseline",
    "baseline-shift",
    "direction",
    "unicode-bidi",
    "writing-mode",
    "startOffset",
    "method",
    "spacing",
    "lengthAdjust",
    "textLength",
    "dx",
    "dy",
    "rotate",
    "offset",
    "stop-color",
    "stop-opacity",
    "gradientUnits",
    "gradientTransform",
    "spreadMethod",
    "fx",
    "fy",
    "fr",
    "clip-path",
    "clip-rule",
    "clipPathUnits",
    "mask",
    "maskUnits",
    "maskContentUnits",
    "mask-type",
    "patternUnits",
    "patternContentUnits",
    "patternTransform",
    "markerWidth",
    "markerHeight",
    "markerUnits",
    "refX",
    "refY",
    "orient",
    "marker-start",
    "marker-mid",
    "marker-end",
    "filter",
    "filterUnits",
    "primitiveUnits",
    "in",
    "in2",
    "result",
    "mode",
    "type",
    "values",
    "operator",
    "k1",
    "k2",
    "k3",
    "k4",
    "order",
    "kernelMatrix",
    "divisor",
    "bias",
    "targetX",
    "targetY",
    "edgeMode",
    "kernelUnitLength",
    "surfaceScale",
    "diffuseConstant",
    "specularConstant",
    "specularExponent",
    "scale",
    "xChannelSelector",
    "yChannelSelector",
    "stdDeviation",
    "flood-color",
    "flood-opacity",
    "lighting-color",
    "radius",
    "baseFrequency",
    "numOctaves",
    "seed",
    "stitchTiles",
    "azimuth",
    "elevation",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "limitingConeAngle",
    "z",
    "tableValues",
    "slope",
    "intercept",
    "amplitude",
    "exponent",
    "style",
}

ACTIVE_ELEMENTS = {
    "script",
    "foreignObject",
    "iframe",
    "object",
    "embed",
    "image",
    "video",
    "audio",
    "a",
    "animate",
    "animateMotion",
    "animateTransform",
    "set",
    "discard",
    "feImage",
    "handler",
}


class SvgError(ValueError):
    pass


def _local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def _safe_css_value(value: str) -> bool:
    lowered = value.lower()
    if any(
        token in lowered
        for token in ("javascript:", "expression", "@import", "behavior", "http:", "https:", "//")
    ):
        return False
    if "url(" in lowered:
        return (
            re.fullmatch(r"url\(\s*['\"]?#[a-zA-Z_][\w:.-]*['\"]?\s*\)", value.strip()) is not None
        )
    return True


def _sanitize_attributes(element: ET.Element) -> None:
    for name, value in list(element.attrib.items()):
        local_name = _local_name(name)
        href = local_name == "href"
        if href and value.startswith("#") and re.fullmatch(r"#[a-zA-Z_][\w:.-]*", value):
            continue
        if local_name not in ALLOWED_ATTRIBUTES or local_name.startswith("on"):
            del element.attrib[name]
            continue
        if local_name == "style" and not _safe_css_value(value):
            del element.attrib[name]
            continue
        if "url(" in value.lower() and not _safe_css_value(value):
            del element.attrib[name]


def sanitize_svg(raw_text: str) -> str:
    if len(raw_text.encode("utf-8")) > MAX_SVG_BYTES:
        raise SvgError("SVG response is too large")
    if re.search(r"<!DOCTYPE|<!ENTITY", raw_text, flags=re.IGNORECASE):
        raise SvgError("SVG document types and entities are not allowed")
    match = re.search(r"<svg\b[\s\S]*</svg\s*>", raw_text, flags=re.IGNORECASE)
    if match is None:
        raise SvgError("No complete SVG document found")
    candidate = match.group(0)
    if re.search(r"<!DOCTYPE|<!ENTITY", candidate, flags=re.IGNORECASE):
        raise SvgError("SVG document types and entities are not allowed")
    try:
        root = ET.fromstring(candidate)
    except ET.ParseError as error:
        raise SvgError("SVG is not well-formed XML") from error
    if _local_name(root.tag) != "svg":
        raise SvgError("Response root is not an SVG element")

    for parent in list(root.iter()):
        for child in list(parent):
            if (
                _local_name(child.tag) in ACTIVE_ELEMENTS
                or _local_name(child.tag) not in ALLOWED_ELEMENTS
            ):
                parent.remove(child)
    for element in root.iter():
        _sanitize_attributes(element)

    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", XLINK_NS)
    result = ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
    if len(result.encode("utf-8")) > MAX_SVG_BYTES:
        raise SvgError("Sanitized SVG is too large")
    return result
