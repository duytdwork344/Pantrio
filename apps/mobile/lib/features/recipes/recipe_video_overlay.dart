import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Owns scroll + muted autoplay/loop video with a draggable PiP overlay.
class RecipeVideoShell extends StatefulWidget {
  const RecipeVideoShell({
    super.key,
    required this.videoUrl,
    required this.builder,
  });

  final String videoUrl;
  final Widget Function(
    BuildContext context,
    ScrollController scrollController,
    Widget heroVideo,
  ) builder;

  @override
  State<RecipeVideoShell> createState() => _RecipeVideoShellState();
}

class _RecipeVideoShellState extends State<RecipeVideoShell> {
  static const double _chromeH = 28;
  static const double _margin = 12;
  static const double _pipWidth = 168;

  final ScrollController _scrollController = ScrollController();
  final GlobalKey _heroKey = GlobalKey();

  VideoPlayerController? _controller;
  bool _ready = false;
  bool _pip = false;
  bool _dismissed = false;
  bool _pipPlaced = false;
  Offset _pipOffset = Offset.zero;
  /// Video area only (chrome is added separately).
  double _videoH = 94;
  BoxConstraints? _stackConstraints;

  Size get _pipOuterSize => Size(_pipWidth, _videoH + _chromeH);

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_updatePipVisibility);
    _initController(widget.videoUrl);
  }

  @override
  void didUpdateWidget(covariant RecipeVideoShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _dismissed = false;
      _pip = false;
      _pipPlaced = false;
      _initController(widget.videoUrl);
    }
  }

  Future<void> _initController(String url) async {
    final previous = _controller;
    _controller = null;
    _ready = false;
    await previous?.dispose();
    if (!mounted) return;

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(0);
      await controller.play();
      if (!mounted || _controller != controller) {
        await controller.dispose();
        return;
      }
      final aspect = controller.value.aspectRatio <= 0
          ? 16 / 9
          : controller.value.aspectRatio;
      setState(() {
        _ready = true;
        _videoH = _pipWidth / aspect;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _updatePipVisibility();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _ready = false);
    }
  }

  void _updatePipVisibility() {
    if (!mounted || _dismissed || !_ready) return;
    final box = _heroKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final pos = box.localToGlobal(Offset.zero);
    final viewHeight = MediaQuery.sizeOf(context).height;
    final shouldPip =
        pos.dy + box.size.height * 0.15 < kToolbarHeight || pos.dy > viewHeight;
    if (shouldPip == _pip) return;
    setState(() {
      _pip = shouldPip;
      if (shouldPip && !_pipPlaced) {
        _placeDefault();
      }
    });
  }

  void _placeDefault() {
    final constraints = _stackConstraints;
    if (constraints == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _pipPlaced || !_pip) return;
        setState(_placeDefault);
      });
      return;
    }
    final outer = _pipOuterSize;
    _pipOffset = Offset(
      (constraints.maxWidth - outer.width - _margin)
          .clamp(0.0, constraints.maxWidth),
      (constraints.maxHeight - outer.height - _margin)
          .clamp(0.0, constraints.maxHeight),
    );
    _pipPlaced = true;
  }

  void _dismissPip() {
    setState(() {
      _dismissed = true;
      _pip = false;
    });
  }

  void _clampPip(Offset next) {
    final constraints = _stackConstraints;
    if (constraints == null) {
      _pipOffset = next;
      return;
    }
    final outer = _pipOuterSize;
    final maxX = (constraints.maxWidth - outer.width - _margin)
        .clamp(_margin, constraints.maxWidth);
    final maxY = (constraints.maxHeight - outer.height - _margin)
        .clamp(_margin, constraints.maxHeight);
    _pipOffset = Offset(
      next.dx.clamp(_margin, maxX),
      next.dy.clamp(_margin, maxY),
    );
  }

  double get _aspect {
    final controller = _controller;
    if (controller == null || controller.value.aspectRatio <= 0) {
      return 16 / 9;
    }
    return controller.value.aspectRatio;
  }

  Widget _buildHero() {
    final controller = _controller;
    return KeyedSubtree(
      key: _heroKey,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: AspectRatio(
          aspectRatio: _aspect,
          child: !_ready || controller == null
              ? const ColoredBox(
                  color: Color(0xFF111111),
                  child: Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              : _pip
                  ? const ColoredBox(color: Color(0xFF111111))
                  : VideoPlayer(controller),
        ),
      ),
    );
  }

  Widget _buildPip() {
    final controller = _controller;
    if (!_pip || _dismissed || !_ready || controller == null) {
      return const SizedBox.shrink();
    }
    final outer = _pipOuterSize;
    return Positioned(
      left: _pipOffset.dx,
      top: _pipOffset.dy,
      width: outer.width,
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            _clampPip(_pipOffset + details.delta);
            _pipPlaced = true;
          });
        },
        child: Material(
          elevation: 10,
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          color: Colors.black,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: _chromeH,
                child: ColoredBox(
                  color: const Color(0xE60F2F24),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Kéo để di chuyển',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 11,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        InkWell(
                          onTap: _dismissPip,
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(
                              Icons.close,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: _pipWidth,
                height: _videoH,
                child: VideoPlayer(controller),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updatePipVisibility);
    _scrollController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _stackConstraints = constraints;
        if (_pip && !_pipPlaced) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _pipPlaced || !_pip) return;
            setState(_placeDefault);
          });
        }
        return Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            widget.builder(context, _scrollController, _buildHero()),
            _buildPip(),
          ],
        );
      },
    );
  }
}
