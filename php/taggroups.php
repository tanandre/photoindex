<?php
include('util.php');

checkModifiedSince(getLastModifiedTimeTags());

$groups = getTagGroups();
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($groups, JSON_NUMERIC_CHECK);
?>
