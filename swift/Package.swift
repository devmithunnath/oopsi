// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Oopsi",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(name: "OopsiClient", targets: ["OopsiClient"]),
        .library(name: "OopsiUI", targets: ["OopsiUI"]),
    ],
    targets: [
        .target(
            name: "OopsiClient",
            path: "Sources/OopsiClient"
        ),
        .target(
            name: "OopsiUI",
            dependencies: ["OopsiClient"],
            path: "Sources/OopsiUI"
        ),
        .testTarget(
            name: "OopsiClientTests",
            dependencies: ["OopsiClient"],
            path: "Tests/OopsiClientTests"
        ),
    ]
)
