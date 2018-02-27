<?php
function connectDb() {
	$servername = "localhost";
	$username = "photoindex";
	$password = "dc0b5jjF7bNjarkA";
	$dbname = "photoindex3";

	return new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
}

function setCacheHeaders($duration) {
	$seconds_to_cache = $duration;
	$ts = gmdate("D, d M Y H:i:s", time() + $seconds_to_cache) . " GMT";
	header("Expires: $ts");
	header("Cache-Control: max-age=$seconds_to_cache");
}

function toQ($items) {
	function q() {
		return "?";
	}
	return join(",", array_map("q", $items));
}

function queryPhotos($tags) {
	function createSql($tags) {
		if (empty($tags)) {
			return "SELECT p.id, p.date, p.path, p.description, p.rating FROM photo p ORDER BY date DESC";
		}
		return "SELECT p.id, p.date, p.path, p.description, p.rating FROM photo p"
			." LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id"
			." WHERE t.name in ("
			.toQ($tags) 
			.") ORDER BY date DESC";
	}

	$dbh = connectDb();
	$stmt = $dbh->prepare(createSql($tags));

	$stmt->execute($tags);
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	return $output;
}

function validateMysqlDate( $date ) {
    return preg_match( '#^(?P<year>\d{2}|\d{4})([- /.])(?P<month>\d{1,2})\2(?P<day>\d{1,2})$#', $date, $matches )
           && checkdate($matches['month'],$matches['day'],$matches['year']);
}

function touchListing() {
	$dbh = connectDb();
	$stmt = $dbh->prepare("UPDATE photo_stats SET listingLastUpdateTime = SYSDATE()");
	$stmt->execute();
	$dbh = null;
}

function touchTags() {
	$dbh = connectDb();
	$stmt = $dbh->prepare("UPDATE photo_stats SET tagLastUpdateTime = SYSDATE()");
	$stmt->execute();
	$dbh = null;
}

function getLastModifiedTimeListing() {
	return getLastModified('listingLastUpdateTime');
}

function getLastModifiedTimeTags() {
	return getLastModified('tagLastUpdateTime');
}

function getLastModified($column) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT ".$column." FROM photo_stats");
	$stmt->execute();
	$row = $stmt->fetch();
	$dbh = null;
	return strtotime($row[$column]);	
}


function checkModifiedSince($lastModified) {
	if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && 
	    strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) >= $lastModified) {
	    header('HTTP/1.0 304 Not Modified');
	    exit;
	}
	header('Last-Modified: '.gmdate('D, d M Y H:i:s', $lastModified).' GMT');
}

function getPhoto($id) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT path FROM photo WHERE id = ?");
	$stmt->execute(array($id));
	$row = $stmt->fetch();
	$dbh = null;
	return $row["path"];
}

function isValidDate($date) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT DATE(?) AS valid");
	$stmt->execute(array($date));
	$row = $stmt->fetch();
	$dbh = null;
	return $row["valid"] != null;
}

function updatePhotosDate($ids, $date) {
	if (!isValidDate($date)) {
		return '-1'.$date;
	}
	$dbh = connectDb();
	$stmt = $dbh->prepare("UPDATE photo SET date = ? WHERE id in (".toQ($ids).")");
	$stmt->execute(array_merge(array($date), $ids));
	$rowCount = $stmt->rowCount();

	if ($rowCount > 0) {
		touchListing();
	}
	$dbh = null;
	return $rowCount;
}

function updatePhotosRating($ids, $value) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("UPDATE photo SET rating = ? WHERE id in (".toQ($ids).")");
	$stmt->execute(array_merge(array($value), $ids));
	$rowCount = $stmt->rowCount();
	if ($rowCount > 0) {
		touchListing();
	}
	$dbh = null;
	return $rowCount;
}

function updatePhotosDateOffset($ids, $daysOffset) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("UPDATE photo SET date = ADDDATE(date, ?) WHERE id in (".toQ($ids).")");
	$stmt->execute(array_merge(array($daysOffset), $ids));
	$rowCount = $stmt->rowCount();
	if ($rowCount > 0) {
		touchListing();
	}
	$dbh = null;
	return $rowCount;
}

function getPhotoTags($id) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?");
	$stmt->execute(array($id));
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	return $output;
}

function getTags() {
	$dbh = connectDb();
	//$stmt = $dbh->prepare("SELECT t.id, t.name FROM tag t inner join tag_group tg ON tg.id = t.groupid");
	$stmt = $dbh->prepare("select t.id, t.name, tg.id as groupId, tg.name as groupName from tag t inner join tag_group tg ON tg.id = t.groupid order by t.name");
	$stmt->execute();
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	return $output;
}

function getPhotoFile($photo, $quality) {
	$file = str_replace("/volume1/photo", "/var/services/photo", $photo);
	if (isset($quality)) {
		$pos = strripos($file, "/");
		$thumb = $quality == 1 ? "/SYNOPHOTO_THUMB_M.jpg" : "/SYNOPHOTO_THUMB_XL.jpg";
		$file = substr($file, 0, $pos)."/@eaDir".substr($file, $pos).$thumb;
	}
	return $file;
}

?>
