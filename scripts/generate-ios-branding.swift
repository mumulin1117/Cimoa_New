

import AppKit
import CoreText
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let project = root.appendingPathComponent("ios/cimoaNeapo")
let assets = project.appendingPathComponent("Assets.xcassets")
let source = project.appendingPathComponent("Branding/AppIcon-source.png")
let theme = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("src/config/theme.json"))) as! [String: Any]
let colors = theme["colors"] as! [String: [String: Any]]
let space = CGColorSpace(name: CGColorSpace.sRGB)!

func color(_ string: String) -> CGColor {
    if string.hasPrefix("#") {
        let number = UInt32(string.dropFirst(), radix: 16)!
        return CGColor(colorSpace: space, components: [CGFloat((number >> 16) & 255) / 255, CGFloat((number >> 8) & 255) / 255, CGFloat(number & 255) / 255, 1])!
    }
    let components = string.dropFirst(5).dropLast().split(separator: ",").map { CGFloat(Double($0.trimmingCharacters(in: .whitespaces))!) }
    precondition(components.count == 4)
    return CGColor(colorSpace: space, components: [components[0] / 255, components[1] / 255, components[2] / 255, components[3]])!
}

func token(_ section: String, _ name: String) -> CGColor { color(colors[section]![name] as! String) }

func gradient(_ value: String, in context: CGContext, size: CGSize) {
    let expression = try! NSRegularExpression(pattern: "#[0-9a-fA-F]{6}(?: ([0-9.]+)%)?")
    let matches = expression.matches(in: value, range: NSRange(value.startIndex..., in: value))
    let gradientColors = matches.map { match -> CGColor in
        let full = String(value[Range(match.range, in: value)!])
        return color(String(full.prefix(7)))
    }
    let locations = matches.enumerated().map { index, match -> CGFloat in
        guard match.range(at: 1).location != NSNotFound else { return CGFloat(index) / CGFloat(matches.count - 1) }
        return CGFloat(Double(value[Range(match.range(at: 1), in: value)!])!) / 100
    }
    let degrees = Double(value.components(separatedBy: "(")[1].components(separatedBy: "deg")[0])!
    let angle = degrees * .pi / 180
    let direction = CGPoint(x: sin(angle), y: -cos(angle))
    let length = abs(direction.x * size.width) + abs(direction.y * size.height)
    let center = CGPoint(x: size.width / 2, y: size.height / 2)
    let start = CGPoint(x: center.x - direction.x * length / 2, y: center.y - direction.y * length / 2)
    let end = CGPoint(x: center.x + direction.x * length / 2, y: center.y + direction.y * length / 2)
    context.drawLinearGradient(CGGradient(colorsSpace: space, colors: gradientColors as CFArray, locations: locations)!, start: start, end: end, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}

func pdf(_ name: String, size: CGSize, draw: (CGContext) -> Void) throws {
    let target = assets.appendingPathComponent("\(name).imageset/\(name).pdf")
    var box = CGRect(origin: .zero, size: size)
    guard let context = CGContext(target as CFURL, mediaBox: &box, nil) else { fatalError("Cannot create launch PDF") }
    context.beginPDFPage(nil)
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)
    draw(context)
    context.endPDFPage()
    context.closePDF()
}


let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)!
precondition(image.width == 1024 && image.height == 1024, "App icon must be 1024 x 1024")
let rgba = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
rgba.draw(image, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let bytes = rgba.data!.assumingMemoryBound(to: UInt8.self)
precondition(stride(from: 3, to: 4096 * 1024, by: 4).allSatisfy { bytes[$0] == 255 }, "Transparent icon pixels require an explicitly approved background")
let opaque = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
opaque.draw(image, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let destination = CGImageDestinationCreateWithURL(assets.appendingPathComponent("AppIcon.appiconset/AppIcon.png") as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, opaque.makeImage()!, nil)
precondition(CGImageDestinationFinalize(destination))
let encoded = CGImageSourceCreateWithURL(assets.appendingPathComponent("AppIcon.appiconset/AppIcon.png") as CFURL, nil)!
let decoded = CGImageSourceCreateImageAtIndex(encoded, 0, nil)!
precondition(decoded.alphaInfo == .none || decoded.alphaInfo == .noneSkipFirst || decoded.alphaInfo == .noneSkipLast)
let verification = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
verification.draw(decoded, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
precondition(memcmp(rgba.data!, verification.data!, 4096 * 1024) == 0, "App icon conversion changed visible pixels")

try pdf("LaunchBackground", size: CGSize(width: 393, height: 799)) { context in
    gradient(colors["page"]!["gradient"] as! String, in: context, size: CGSize(width: 393, height: 799))
}

try pdf("LaunchBrand", size: CGSize(width: 150, height: 100)) { context in

    context.saveGState()
    context.translateBy(x: (150 - 81) / 2, y: 0)
    context.scaleBy(x: 81 / 58, y: 22.8 / 16)
    let arc = CGMutablePath()
    arc.move(to: CGPoint(x: 3, y: 14))
    arc.addCurve(to: CGPoint(x: 29, y: 2), control1: CGPoint(x: 3, y: 7), control2: CGPoint(x: 11.5, y: 2))
    arc.addCurve(to: CGPoint(x: 55, y: 14), control1: CGPoint(x: 46.5, y: 2), control2: CGPoint(x: 55, y: 7))
    context.addPath(arc)
    context.setLineWidth(4)
    context.setLineCap(.round)
    context.replacePathWithStrokedPath()
    context.clip()
    let arcColors = [token("brand", "cyan"), token("brand", "arc_mid"), token("brand", "pink")]
    context.drawLinearGradient(CGGradient(colorsSpace: space, colors: arcColors as CFArray, locations: [0, 0.5, 1])!, start: .zero, end: CGPoint(x: 58, y: 0), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    context.restoreGState()

    let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 30, weight: .regular), .kern: 9, .foregroundColor: NSColor(cgColor: token("text", "title"))!]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: "Cimoa", attributes: attributes))
    let bounds = CTLineGetImageBounds(line, context)
    context.saveGState()
    context.translateBy(x: (150 - bounds.width) / 2 - bounds.minX, y: 55)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(line, context)
    context.restoreGState()

    let track = CGRect(x: 0, y: 96, width: 150, height: 4)
    context.setFillColor(token("surface", "splash_track"))
    context.addPath(CGPath(roundedRect: track, cornerWidth: 2, cornerHeight: 2, transform: nil))
    context.fillPath()

}

let components = token("page", "background").components!
let colorCatalog: [String: Any] = ["colors": [["idiom": "universal", "color": ["color-space": "srgb", "components": ["red": String(Double(components[0])), "green": String(Double(components[1])), "blue": String(Double(components[2])), "alpha": "1.000"]]]], "info": ["author": "xcode", "version": 1]]
let colorFolder = assets.appendingPathComponent("LaunchBackgroundColor.colorset")
try FileManager.default.createDirectory(at: colorFolder, withIntermediateDirectories: true)
try JSONSerialization.data(withJSONObject: colorCatalog, options: [.prettyPrinted, .sortedKeys]).write(to: colorFolder.appendingPathComponent("Contents.json"))
print("Compiled the supplied opaque 1024px icon and theme-derived Cimoa launch vectors.")
