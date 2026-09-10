<?php
// Execute the original award function's calculation block, not a rewritten oracle.
// The caller must verify the plugin ZIP fingerprint before supplying this file.
$source = file_get_contents($argv[1]);
function extract_function($source, $name) {
    $start = strpos($source, 'function ' . $name . '(');
    if ($start === false) throw new Exception('Missing source function');
    $open = strpos($source, '{', $start);
    $depth = 1;
    for ($i = $open + 1; $depth > 0 && $i < strlen($source); $i++) {
        if ($source[$i] === '{') $depth++;
        if ($source[$i] === '}') $depth--;
    }
    if ($depth !== 0) throw new Exception('Unbalanced source');
    return substr($source, $start, $i - $start);
}
$start = strpos($source, 'function lionsclub_score_summary_page()');
$end = strpos($source, '// Display the awards in a table', $start);
if ($start === false || $end === false) throw new Exception('Source boundaries changed');
$block = substr($source, $start, $end - $start);
// Preserve all source comparisons, usort calls, exclusions, and duplicate detection.
$block .= '\n $result = array_merge($awards, $top_40); foreach ($result as $label => $row) { $row->award = $label; } return array_values($result); }';
$block = str_replace('\\n', "\n", $block);
class OracleWpdb {
    public $prefix = 'qkby_';
    public $connection;
    public $input;
    function __construct() {
        $uri = parse_url(getenv('LEGACY_DB_URL'));
        if (!in_array($uri['host'], ['localhost','127.0.0.1','[::1]'], true)
            || $uri['path'] !== '/car_show_reference') throw new Exception('Unsafe native host');
        $this->connection = mysqli_connect($uri['host'], rawurldecode($uri['user']),
            rawurldecode($uri['pass'] ?? ''), 'car_show_reference', $uri['port'] ?? 3306,
            getenv('LEGACY_DB_SOCKET') ?: null);
        mysqli_set_charset($this->connection, 'utf8mb4');
        mysqli_query($this->connection, 'SET TRANSACTION READ ONLY');
        mysqli_query($this->connection, 'START TRANSACTION WITH CONSISTENT SNAPSHOT');
    }
    function get_results($sql) {
        // Match WordPress wpdb text-query/fetch-object behavior, including scalar types.
        $result = mysqli_query($this->connection, $sql);
        $rows = [];
        while ($row = mysqli_fetch_object($result)) $rows[] = $row;
        $this->input = array_map(fn($row) => clone $row, $rows);
        return $rows;
    }
}
$expected_input = json_decode(stream_get_contents(STDIN));
$wpdb = new OracleWpdb();
eval(extract_function($source, 'get_car_classification'));
eval($block);
$rows = lionsclub_score_summary_page();
if (array_map(fn($r) => (string)$r->id, $expected_input) !== array_map(fn($r) => (string)$r->id, $wpdb->input)) throw new Exception('Native input order changed');
mysqli_rollback($wpdb->connection);
echo json_encode(['php_version'=>PHP_VERSION, 'score_scalar_type'=>gettype($wpdb->input[0]->total_score),
    'null_vs_database_zero'=>null <=> '0', 'awards'=>$rows], JSON_THROW_ON_ERROR);
mysqli_close($wpdb->connection);
