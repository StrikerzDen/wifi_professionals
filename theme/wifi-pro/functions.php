<?php
/**
 * Wi-Fi Pro block theme.
 *
 * Note: Google AdSense is NOT loaded here. It is injected by the WPCode plugin
 * (Header & Footer), so it survives theme changes. ads.txt is served by the
 * Ads.txt Manager plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WIFI_PRO_VERSION', '0.8.5' );

add_action( 'after_setup_theme', function () {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/custom.css' );
} );

add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'wifi-pro-fonts',
		'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap',
		array(),
		null
	);
	wp_enqueue_style(
		'wifi-pro-custom',
		get_theme_file_uri( 'assets/css/custom.css' ),
		array(),
		WIFI_PRO_VERSION
	);
} );

/**
 * View counts, read from the Post Views Counter plugin.
 *
 * [wifi_most_viewed number="6"]  numbered list of the most viewed posts with counts (sidebar)
 * wifi-pro/views block         small "418k views" pill inside a query loop (cards)
 *
 * Both output nothing if the plugin is inactive, so the theme never breaks without it.
 */
function wifi_pro_compact_number( $n ) {
	$n = (int) $n;
	if ( $n >= 1000000 ) {
		return round( $n / 1000000, 1 ) . 'M';
	}
	if ( $n >= 1000 ) {
		return round( $n / 1000, $n >= 100000 ? 0 : 1 ) . 'k';
	}
	return (string) $n;
}

add_shortcode( 'wifi_most_viewed', function ( $atts ) {
	if ( ! function_exists( 'pvc_get_most_viewed_posts' ) || ! function_exists( 'pvc_get_post_views' ) ) {
		return '';
	}
	$a     = shortcode_atts( array( 'number' => 6 ), $atts, 'wifi_most_viewed' );
	$posts = pvc_get_most_viewed_posts( array( 'posts_per_page' => max( 1, (int) $a['number'] ) ) );
	if ( empty( $posts ) ) {
		return '';
	}
	$out = '<ol class="mv-list">';
	foreach ( $posts as $p ) {
		$views = (int) pvc_get_post_views( $p->ID );
		$out  .= sprintf(
			'<li><a class="mv-title" href="%s">%s</a><span class="mv-count">%s views</span></li>',
			esc_url( get_permalink( $p ) ),
			esc_html( get_the_title( $p ) ),
			esc_html( number_format_i18n( $views ) )
		);
	}
	return $out . '</ol>';
} );

/* Block version for post lists: gets the post from the query loop context. */
add_action( 'init', function () {
	register_block_type( 'wifi-pro/views', array(
		'api_version'     => 3,
		'title'           => 'Post views',
		'category'        => 'theme',
		'uses_context'    => array( 'postId' ),
		'render_callback' => function ( $attributes, $content, $block ) {
			if ( ! function_exists( 'pvc_get_post_views' ) || empty( $block->context['postId'] ) ) {
				return '';
			}
			$views = (int) pvc_get_post_views( (int) $block->context['postId'] );
			if ( $views < 1 ) {
				return '';
			}
			return '<span class="views-pill">' . esc_html( wifi_pro_compact_number( $views ) ) . ' views</span>';
		},
	) );
} );


/**
 * Wi-Fi Pro Lab: interactive models.
 *
 * [wifi_lab model="channels" band="5"] prints a mount point; assets/lab/lab.js builds the model.
 * Models: region, regrules, waves, channels, timeline, pathloss, phyrate, quiz, dsss, fhss, cck, ofdm, barker.
 * band is 2.4, 5 or 6 (ignored by models that do not need it).
 * The lab assets load only on lab pages.
 */
add_shortcode( 'wifi_lab', function ( $atts ) {
	$a = shortcode_atts( array( 'model' => '', 'band' => '2.4', 'label' => '' ), $atts, 'wifi_lab' );
	$allowed = array( 'region', 'regrules', 'waves', 'channels', 'timeline', 'pathloss', 'phyrate', 'quiz', 'dsss', 'fhss', 'cck', 'ofdm', 'barker', 'wavebasics', 'superpos', 'decibels', 'linkbudget', 'antenna', 'fresnel', 'qam', 'ofdma', 'mimo', 'csma', 'airtime', 'generations', 'assoc', 'roaming', 'coexist', 'hidden', 'snr', 'qoe', 'capacity', 'checklist', 'macframe', 'ppdu', 'aggregation', 'journeydsss', 'journeyfhss', 'journeycck', 'journeyofdm', 'journeyqam', 'journeyofdma', 'journeymimo', 'journeyqos', 'journeybss' );
	if ( ! in_array( $a['model'], $allowed, true ) ) {
		return '';
	}
	$band  = in_array( $a['band'], array( '2.4', '5', '6', 'dsss', 'fhss', 'cck', 'ofdm', 'fwaves', 'fdb', 'fprop', 'qam', 'ofdma', 'mimo', 'mac', 'gens', 'assoc', 'coex', 'meas', 'eng', 'frames' ), true ) ? $a['band'] : '2.4';   // a band, or a modulation topic for quizzes
	$class = 'lab-model' . ( 'region' === $a['model'] ? ' lab-model--bar' : '' );
	$label = $a['label'] ? $a['label'] : 'Interactive model: ' . $a['model'];
	return sprintf( '<div class="%s" data-model="%s" data-band="%s" role="group" aria-label="%s"></div>', esc_attr( $class ), esc_attr( $a['model'] ), esc_attr( $band ), esc_attr( $label ) );
} );


/**
 * Topic navigation for Wi-Fi Pro Lab pages.
 * [wifi_lab_nav position="top"]     band switcher: all sibling lessons, current one highlighted
 * [wifi_lab_nav position="bottom"]  previous / next lesson cards
 * Siblings are the published child pages of the same parent, in menu order, so new lessons appear automatically.
 */
function wifi_pro_lesson_short_title( $post ) {
	$t = trim( strtok( get_the_title( $post ), ':' ) );
	return $t;
}

add_shortcode( 'wifi_lab_nav', function ( $atts ) {
	$a    = shortcode_atts( array( 'position' => 'top' ), $atts, 'wifi_lab_nav' );
	$post = get_queried_object();
	if ( ! $post || empty( $post->post_parent ) ) {
		return '';
	}
	$parent  = get_post( $post->post_parent );
	$lessons = get_pages( array(
		'child_of'     => (int) $post->post_parent,
		'parent'       => (int) $post->post_parent,
		'post_status'  => 'publish',
		'meta_key'     => '_wp_page_template',
		'meta_value'   => 'lab-lesson',
		'sort_column'  => 'menu_order,post_title',
		'sort_order'   => 'ASC',
	) );
	if ( count( $lessons ) < 1 ) {
		return '';
	}
	$hub_url   = get_permalink( $parent );
	$is_lab_root = $parent && 'lab' === $parent->post_name;
	$mod         = $is_lab_root ? get_page_by_path( 'lab/modulation' ) : null;
	$chain       = array( 'foundations' => 'lab/2-4-ghz', 'modulation' => 'lab/protocol/mac', 'protocol' => 'lab/connecting/association', 'connecting' => 'lab/measurement/troubleshooting' );   // each part leads on to the next part of the book
	$after       = ( $parent && isset( $chain[ $parent->post_name ] ) ) ? get_page_by_path( $chain[ $parent->post_name ] ) : null;
	$hub_title = get_the_title( $parent );

	if ( 'top' === $a['position'] ) {
		$out = '<nav class="lab-bandnav" aria-label="Lab topics"><a class="lab-bandnav__all" href="' . esc_url( $hub_url ) . '">&larr; ' . esc_html( $is_lab_root ? 'Lab contents' : preg_replace( '/:.*$/', '', $hub_title ) ) . '</a><ul>';
		foreach ( $lessons as $l ) {
			$cur  = ( (int) $l->ID === (int) $post->ID );
			$out .= '<li><a href="' . esc_url( get_permalink( $l ) ) . '"' . ( $cur ? ' aria-current="page"' : '' ) . '>' . esc_html( preg_replace( '/ Wi-Fi.*$/', '', wifi_pro_lesson_short_title( $l ) ) ) . '</a></li>';
		}
		return $out . '</ul></nav>';
	}

	$idx = 0;
	foreach ( $lessons as $i => $l ) {
		if ( (int) $l->ID === (int) $post->ID ) {
			$idx = $i;
		}
	}
	$prev = $idx > 0 ? $lessons[ $idx - 1 ] : null;
	$next = $idx < count( $lessons ) - 1 ? $lessons[ $idx + 1 ] : null;

	$card = function ( $cls, $label, $title, $url ) {
		return '<a class="lab-pager__' . $cls . '" href="' . esc_url( $url ) . '"><span>' . esc_html( $label ) . '</span><b>' . esc_html( $title ) . '</b></a>';
	};
	$out  = '<nav class="lab-pager" aria-label="Previous and next topic">';
	$out .= $prev ? $card( 'prev', '← Previous topic', wifi_pro_lesson_short_title( $prev ), get_permalink( $prev ) ) : $card( 'prev', '← Back to', $is_lab_root ? 'Lab contents' : preg_replace( '/:.*$/', '', $hub_title ), $hub_url );
	$out .= $next ? $card( 'next', 'Next topic →', wifi_pro_lesson_short_title( $next ), get_permalink( $next ) ) : ( $is_lab_root && $mod ? $card( 'next', 'Next part of the book →', 'Modulation and waveforms', get_permalink( $mod ) ) : ( $after ? $card( 'next', 'Next part of the book →', wifi_pro_lesson_short_title( $after ), get_permalink( $after ) ) : $card( 'next', 'That was the last topic so far →', 'Back to the contents and what is planned', $hub_url ) ) );
	return $out . '</nav>';
} );

function wifi_pro_is_lab_page() {
	if ( ! is_page() ) {
		return false;
	}
	$post = get_queried_object();
	if ( ! $post ) {
		return false;
	}
	if ( 'lab' === $post->post_name || 'lab-lesson' === get_page_template_slug( $post ) || has_shortcode( $post->post_content, 'wifi_lab' ) ) {
		return true;
	}
	foreach ( get_post_ancestors( $post ) as $anc ) {   // every page below the Lab
		if ( 'lab' === get_post_field( 'post_name', $anc ) ) {
			return true;
		}
	}
	return false;
}

/* Breadcrumbs for lab lessons: Wi-Fi Pro Lab > (section) > this lesson, from the real page hierarchy. */
add_shortcode( 'wifi_lab_crumbs', function () {
	$post = get_queried_object();
	if ( ! $post ) {
		return '';
	}
	$parts = array();
	foreach ( array_reverse( get_post_ancestors( $post ) ) as $anc ) {
		$parts[] = '<a href="' . esc_url( get_permalink( $anc ) ) . '">' . esc_html( preg_replace( '/:.*$/', '', get_the_title( $anc ) ) ) . '</a>';
	}
	return '<p class="lab-crumbs">' . implode( ' &rsaquo; ', $parts ) . '</p>';
} );

add_action( 'wp_enqueue_scripts', function () {
	if ( ! wifi_pro_is_lab_page() ) {
		return;
	}
	wp_enqueue_style( 'wifi-pro-lab', get_theme_file_uri( 'assets/lab/lab.css' ), array( 'wifi-pro-custom' ), WIFI_PRO_VERSION );
	wp_enqueue_script( 'wifi-pro-lab', get_theme_file_uri( 'assets/lab/lab.js' ), array(), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-waveforms', get_theme_file_uri( 'assets/lab/waveforms.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-foundations', get_theme_file_uri( 'assets/lab/foundations.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-topics1', get_theme_file_uri( 'assets/lab/topics1.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-topics2', get_theme_file_uri( 'assets/lab/topics2.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-frames', get_theme_file_uri( 'assets/lab/frames.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-journey', get_theme_file_uri( 'assets/lab/journey.js' ), array( 'wifi-pro-lab' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_enqueue_script( 'wifi-pro-lab-journey2', get_theme_file_uri( 'assets/lab/journey2.js' ), array( 'wifi-pro-lab-journey' ), WIFI_PRO_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
} );


/**
 * Permanent redirects for addresses that moved when the site was reorganised, so old links, bookmarks and
 * search results keep working. The Blog became the Library, the old catch-all categories were merged into
 * topic categories, and the About post became a real page.
 */
add_action( 'template_redirect', function () {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$path = untrailingslashit( (string) wp_parse_url( $uri, PHP_URL_PATH ) );
	$map  = array(
		'/blog'                       => '/library/',
		'/category/general'           => '/library/',
		'/category/fun'               => '/category/resources-community/',
		'/category/youtube-channels'  => '/category/resources-community/',
		'/category/cwne-journey'      => '/category/exam-prep/',
		'/2019/08/about'              => '/about/',
	);
	if ( isset( $map[ $path ] ) ) {
		wp_safe_redirect( home_url( $map[ $path ] ), 301 );
		exit;
	}
}, 1 );

/* Homepage-only script: hero wavelength demo. */
add_action( 'wp_enqueue_scripts', function () {
	if ( is_front_page() ) {
		wp_enqueue_script(
			'wifi-pro-wave-demo',
			get_theme_file_uri( 'assets/js/wave-demo.js' ),
			array(),
			WIFI_PRO_VERSION,
			array( 'strategy' => 'defer', 'in_footer' => true )
		);
	}
} );

/* Preconnect to Google Fonts. */
add_filter( 'wp_resource_hints', function ( $hints, $relation ) {
	if ( 'preconnect' === $relation ) {
		$hints[] = 'https://fonts.googleapis.com';
		$hints[] = array( 'href' => 'https://fonts.gstatic.com', 'crossorigin' => 'anonymous' );
	}
	return $hints;
}, 10, 2 );
